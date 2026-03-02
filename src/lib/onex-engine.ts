import { chromium, Page } from "playwright";

/**
 * Normalizes text for comparison.
 */
function normalize(text: string | null | undefined) {
    return String(text || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[\(\)]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

export interface StudentRecord {
    admission_no: string;
    mid1: string;
    mid2: string;
    assessment: string;
    uploaded_status?: string;
    [key: string]: string | undefined;
}

export interface ContextOptions {
    programType: string;
    courseId: string;
    course: string;
    examSeries: string;
    semester: string;
    markType: string;
    subject: string;
}

export class OnexEngine {
    private logCallback: (msg: string, type?: "info" | "success" | "warning" | "error") => void;

    constructor(cb: (msg: string, type?: any) => void) {
        this.logCallback = cb;
    }

    private log(msg: string, type: any = "info") {
        this.logCallback(msg, type);
    }

    async run(students: StudentRecord[], credentials: { user: string; pass: string }, context: ContextOptions, checkAborted: () => boolean = () => false) {
        this.log("🚀 Initializing Onex Engine...", "info");

        // Filter out already uploaded students
        const pending = students.filter(s => normalize(s.uploaded_status) !== "yes");

        if (pending.length === 0) {
            this.log("✅ All students in this set are already synced (UPLOADED).", "success");
            return;
        }

        const skipped = students.length - pending.length;
        if (skipped > 0) {
            this.log(`⏭️ Skipping ${skipped} students that were already marked 'YES'`, "warning");
        }

        this.log(`📊 Processing ${pending.length} pending students for: ${context.subject}`, "info");

        if (checkAborted()) {
            this.log("🛑 Engine Stopped via User Request.", "warning");
            return;
        }

        const browser = await chromium.launch({ headless: false });
        const page = await (await browser.newContext()).newPage();
        page.setDefaultTimeout(35000);

        try {
            this.log("🔐 Logging in...", "info");
            await page.goto("https://chaitanya.uonex.in/", { waitUntil: "domcontentloaded" });
            await page.getByRole("textbox", { name: "Username" }).fill(credentials.user);
            await page.getByRole("textbox", { name: "password" }).fill(credentials.pass);
            await page.getByRole("button", { name: "Sign in" }).click();

            this.log("📂 Navigating to Marks Entry page...", "info");
            await page.waitForTimeout(2000);
            await page.goto("https://chaitanya.uonex.in/FacultyInternalAndPracticalMarksViewAndEdit", { waitUntil: "domcontentloaded" });

            // SELECT CONTEXT (From UI Overrides)
            this.log(`📁 Setting context: ${context.subject}...`, "info");
            await this.forceSelect(page, "Program Type", context.programType);
            await this.forceSelect(page, "Course Id", context.courseId);
            await this.forceSelect(page, "Course", context.course);
            await this.forceSelect(page, "Exam Series", context.examSeries);
            await this.forceSelect(page, "Semester", context.semester);
            await this.forceSelect(page, "Mark Type", context.markType);
            await this.forceSelect(page, "Subject", context.subject);

            this.log("▶ Submitting Selection...", "info");
            await page.getByRole("button", { name: "Submit" }).first().click();
            await page.waitForTimeout(4000);

            const search = page.locator('input[type="search"]').first();
            const successList: string[] = [];
            let currentBatchList: string[] = [];

            for (const s of pending) {
                if (checkAborted()) {
                    this.log("🛑 FORCE STOP Detacted! Halting engine and saving existing progress...", "warning");
                    break;
                }
                const adm = s.admission_no;
                try {
                    await search.fill("");
                    await search.fill(adm);
                    await page.waitForTimeout(800);

                    const row = page.locator("tr", { hasText: adm }).first();
                    const inputs = row.locator('input[type="text"]');
                    const count = await inputs.count();

                    if (count >= 3) {
                        await this.fillMarkReliable(page, inputs.nth(0), s.mid1);
                        await this.fillMarkReliable(page, inputs.nth(1), s.mid2);

                        if (count >= 4) {
                            await this.fillMarkReliable(page, inputs.nth(3), s.assessment);
                        } else {
                            await this.fillMarkReliable(page, inputs.nth(2), s.assessment);
                        }

                        successList.push(adm);
                        currentBatchList.push(adm);
                        this.log(`   [${adm}] ✅ Ready`, "success");
                    } else {
                        this.log(`   [${adm}] ⚠️ Row/Inputs missing.`, "warning");
                    }
                } catch (e: any) {
                    this.log(`   [${adm}] ❌ Error: ${e.message.slice(0, 30)}`, "error");
                }
            }

            if (currentBatchList.length > 0) {
                this.log(`💾 All ${currentBatchList.length} students typed in!`, "success");
                this.log("⏸️ WAITING FOR YOU TO MANUALLY CLICK 'SAVE' AND 'OK' ON THE PORTAL...", "warning");
                this.log("⏳ The browser will stay open for up to 20 minutes so you can safely process it.", "info");

                try {
                    // Give user total control over saving. Only proceed once we see the success popup appear and clear it.
                    let saved = false;
                    for (let i = 0; i < 1200; i++) { // 20 minutes
                        if (checkAborted()) {
                            this.log("🛑 User used Force Stop during the save wait phase.", "warning");
                            break;
                        }

                        // We constantly scan the page for a success confirmation popup (like SweetAlert)
                        // If we see it, we will auto-click "OK" for you and finalize the run.
                        if (await this.handlePopups(page)) {
                            this.log("✅ Detected Portal Success Popup! Confirmed Saved.", "success");
                            saved = true;
                            // Wait for the popup animation to disappear completely before closing
                            await page.waitForTimeout(2000);
                            break;
                        }
                        await page.waitForTimeout(1000);
                    }
                    if (!saved) {
                        this.log("⚠️ 20-minute timer expired without seeing a success popup. Closing automatically...", "warning");
                    }
                } catch (e) {
                    this.log("⚠️ Save Wait Phase Interrupted.", "error");
                }

                // Finalize those last synced candidates
                this.log(`SYNC_UPDATE:${currentBatchList.join(",")}`, "info");
            }

            // A short delay making sure CSV updates propagate
            await new Promise(r => setTimeout(r, 2000));
            this.log("🎉 PROCESS COMPLETE! You may now download the CSV.", "success");
        } catch (e: any) {
            this.log(`‼️ FATAL ERROR: ${e.message}`, "error");
        } finally {
            await browser.close();
        }
    }

    private async forceSelect(page: Page, labelText: string, targetValue: string) {
        const targetNorm = normalize(targetValue);
        const container = page.locator('.form-group, .row, .col-md-3, .col-sm-3')
            .filter({ hasText: new RegExp(`^${labelText}$|${labelText}`, 'i') })
            .last();

        try {
            const trigger = container.locator('.select2-selection, .select2-container').first();
            await trigger.scrollIntoViewIfNeeded();
            await trigger.click({ force: true });
            await page.waitForTimeout(600);

            const searchField = page.locator('input.select2-search__field:visible');
            if (await searchField.count() > 0) {
                const query = targetValue.includes("NXT") ? "NXT" : targetValue.substring(0, 8);
                await searchField.fill(query);
                await page.waitForTimeout(800);
            }

            const options = page.locator('li.select2-results__option[role="option"]');
            const count = await options.count();
            let picked = false;
            for (let i = 0; i < count; i++) {
                const txt = await options.nth(i).innerText();
                if (txt === "Select") continue;
                if (normalize(txt).includes(targetNorm)) {
                    await options.nth(i).click(); picked = true; break;
                }
            }
            if (!picked && count > 1) await options.nth(1).click();
            await page.waitForTimeout(1000);
        } catch (err) { }
    }

    private async fillMarkReliable(page: Page, input: any, value: string) {
        if (value === undefined || value === "") return;
        await input.click();
        await input.clear();
        await input.pressSequentially(String(value), { delay: 40 });
        await input.press('Tab');
        await page.waitForTimeout(300);
    }

    private async handlePopups(page: Page) {
        const selectors = ['button:has-text("OK")', 'button:has-text("Yes")', '.swal2-confirm', '.confirm'];
        for (const sel of selectors) {
            const btn = page.locator(sel).filter({ visible: true }).first();
            if (await btn.count() > 0) {
                await btn.click();
                await page.waitForTimeout(800);
                return true;
            }
        }
        return false;
    }
}
