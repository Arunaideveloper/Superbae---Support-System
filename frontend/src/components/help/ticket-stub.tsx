"use client";

export interface TicketStubData {
  reference: string;
  subject: string;
  status: string;
  createdAt?: string;
}

const TEMPLATE = "/support-ticket.png";

// Positions calibrated to support-ticket.png (percent of image W/H).
const CHIP_CX = [33.6, 43.6, 53.8, 63.6]; // 4 pill centers (ENTRANCE/SECTOR/ROW/SEAT)
const CHIP_CY = 69.7;
const CHIP_W = 9.6;
const CHIP_H = 5.2;
const VLABEL = { left: 85.0, top: 36.0, width: 5.6, height: 37.0 }; // vertical barcode label

function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/** The real Superbae support-ticket artwork with the live reference overlaid on it. */
export function TicketStub({ reference, subject, status, createdAt }: TicketStubData) {
  return (
    <div>
      <div style={{ containerType: "inline-size" }} className="relative w-full overflow-hidden rounded-xl shadow-[0_10px_28px_-14px_rgba(217,85,123,0.5)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TEMPLATE} alt="Superbae support ticket" className="block w-full" />

        {/* 4 chip references */}
        {CHIP_CX.map((cx, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full"
            style={{ left: `${cx - CHIP_W / 2}%`, top: `${CHIP_CY - CHIP_H / 2}%`, width: `${CHIP_W}%`, height: `${CHIP_H}%`, background: "#e85096" }}
          >
            <span style={{ fontSize: "1.25cqw", fontWeight: 800, color: "#fff", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{reference}</span>
          </div>
        ))}

        {/* vertical barcode-side reference */}
        <div
          className="absolute flex items-center justify-center"
          style={{ left: `${VLABEL.left}%`, top: `${VLABEL.top}%`, width: `${VLABEL.width}%`, height: `${VLABEL.height}%`, background: "#fff" }}
        >
          <span style={{ fontSize: "1.75cqw", fontWeight: 800, color: "#e85096", letterSpacing: "0.06em", writingMode: "vertical-rl", whiteSpace: "nowrap" }}>{reference}</span>
        </div>
      </div>

      {/* details below the ticket art */}
      <div className="mt-3 rounded-xl border border-[#f0e6ec] bg-card px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[1.5px] text-[#b26b8e]">SUBJECT</div>
        <div className="text-[14px] font-semibold text-foreground">{subject}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-full bg-[#fbe3ea] px-2.5 py-1 text-[11px] font-bold capitalize text-[#b23a5e]">{status}</span>
          <span className="text-[11px] text-muted-foreground">{fmtDate(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/** Opens a clean print window with the real ticket art + overlaid reference. */
export function printTicket(d: TicketStubData) {
  const w = window.open("", "_blank", "width=720,height=560");
  if (!w) return;
  const src = `${window.location.origin}${TEMPLATE}`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const ref = esc(d.reference);
  const chips = CHIP_CX.map(
    (cx) => `<div class="chip" style="left:${cx - CHIP_W / 2}%;top:${CHIP_CY - CHIP_H / 2}%;width:${CHIP_W}%;height:${CHIP_H}%"><span>${ref}</span></div>`
  ).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Superbae Ticket ${ref}</title>
  <style>
    @page{margin:12mm}
    body{margin:0;font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#fff}
    .wrap{max-width:900px;margin:0 auto;container-type:inline-size;position:relative}
    .wrap img{display:block;width:100%}
    .chip{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:999px;background:#e85096}
    .chip span{font-size:1.25cqw;font-weight:800;color:#fff;letter-spacing:.02em;white-space:nowrap}
    .vlabel{position:absolute;left:${VLABEL.left}%;top:${VLABEL.top}%;width:${VLABEL.width}%;height:${VLABEL.height}%;background:#fff;display:flex;align-items:center;justify-content:center}
    .vlabel span{font-size:1.75cqw;font-weight:800;color:#e85096;letter-spacing:.06em;writing-mode:vertical-rl;white-space:nowrap}
    .meta{max-width:900px;margin:14px auto 0;font-size:13px;color:#3a2b33}
    .meta b{color:#d9557b}
  </style></head><body>
    <div class="wrap"><img src="${src}" alt="Superbae support ticket"/>${chips}
      <div class="vlabel"><span>${ref}</span></div>
    </div>
    <div class="meta"><b>Reference:</b> ${ref} &nbsp;·&nbsp; <b>Subject:</b> ${esc(d.subject)} &nbsp;·&nbsp; <b>Status:</b> ${esc(d.status)}</div>
    <script>var i=document.images[0];function go(){setTimeout(function(){window.print();},150);}if(i.complete)go();else i.onload=go;</script>
  </body></html>`);
  w.document.close();
}
