import { NextRequest, NextResponse } from "next/server";
import { OnexEngine, StudentRecord, ContextOptions } from "@/lib/onex-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { students, credentials, context } = await req.json();

    if (!students || !credentials || !context) {
        return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const responseHeaders = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    };

    const stream = new ReadableStream({
        async start(controller) {
            const log = (msg: string, type: string = "info") => {
                const data = JSON.stringify({ msg, type });
                controller.enqueue(`data: ${data}\n\n`);
            };

            const engine = new OnexEngine(log);

            try {
                // req.signal.aborted instantly becomes true if the client disconnects/aborts
                const checkAborted = () => req.signal.aborted;

                await engine.run(students as StudentRecord[], credentials, context as ContextOptions, checkAborted);
                log("🎉 Batch process finished.", "success");
            } catch (e: any) {
                log(`‼️ Fatal error: ${e.message}`, "error");
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, { headers: responseHeaders });
}
