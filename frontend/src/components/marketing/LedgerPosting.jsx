import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";

/* The signature: a casual chat line is typed, then "posted" as a row in a
   real ledger (buku besar) with a running balance. Conversation → bookkeeping. */

const SALDO_AWAL = 1_280_000;

const ENTRIES = [
  { chat: "makan siang 35rb di warteg", ket: "Makan siang", kat: "Makanan", type: "debit", amount: 35_000 },
  { chat: "bensin motor 50rb", ket: "Bensin motor", kat: "Transport", type: "debit", amount: 50_000 },
  { chat: "freelance masuk 750rb 🎉", ket: "Proyek freelance", kat: "Pemasukan", type: "kredit", amount: 750_000 },
  { chat: "kopi sore 28rb", ket: "Kopi sore", kat: "Jajan", type: "debit", amount: 28_000 },
];

const rp = (n) => n.toLocaleString("id-ID");

function buildAll() {
  let saldo = SALDO_AWAL;
  return ENTRIES.map((e) => {
    saldo += e.type === "kredit" ? e.amount : -e.amount;
    return { ...e, saldo };
  });
}

function LedgerRow({ row, fresh }) {
  const debit = row.type === "debit";
  return (
    <div className={`px-4 py-2.5 ${fresh ? "animate-post-row" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.8rem] text-paper-ink truncate">{row.ket}</span>
        <span
          className={`font-mono text-[0.8rem] tnum shrink-0 ${debit ? "text-debit" : "text-moss font-semibold"}`}
        >
          {debit ? "−" : "+"}Rp{rp(row.amount)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 mt-0.5">
        <span className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-paper-mut">
          {row.kat}
        </span>
        <span className="font-mono text-[0.62rem] tnum text-paper-mut shrink-0">
          Saldo Rp{rp(row.saldo)}
        </span>
      </div>
    </div>
  );
}

export default function LedgerPosting() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const all = buildAll();
  const [rows, setRows] = useState(reduced ? all : []);
  const [typed, setTyped] = useState(reduced ? ENTRIES[ENTRIES.length - 1].chat : "");
  const [phase, setPhase] = useState("idle"); // typing | posting | posted
  const cancelled = useRef(false);

  useEffect(() => {
    if (reduced) return;
    cancelled.current = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function run() {
      while (!cancelled.current) {
        setRows([]);
        setTyped("");
        setPhase("idle");
        let saldo = SALDO_AWAL;
        await sleep(700);
        for (const e of ENTRIES) {
          if (cancelled.current) return;
          setPhase("typing");
          for (let i = 1; i <= e.chat.length; i++) {
            if (cancelled.current) return;
            setTyped(e.chat.slice(0, i));
            await sleep(36);
          }
          await sleep(450);
          if (cancelled.current) return;
          setPhase("posting");
          await sleep(680);
          saldo += e.type === "kredit" ? e.amount : -e.amount;
          const saldoNow = saldo;
          setRows((prev) => [...prev, { ...e, saldo: saldoNow }]);
          setPhase("posted");
          await sleep(1500);
        }
        await sleep(2000);
      }
    }
    run();
    return () => {
      cancelled.current = true;
    };
  }, [reduced]);

  return (
    <div className="bg-ink-soft rounded-2xl border border-ledger-line shadow-xl shadow-[#123a73]/10 overflow-hidden">
      {/* Chat region */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-fog">
            Chat · FiNot
          </span>
          <span className="h-px flex-1 bg-ledger-line" />
        </div>

        <div className="flex justify-end min-h-[2.25rem]">
          <div className="bg-ink-2 text-cream rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[85%] text-sm">
            <span className={phase === "typing" ? "caret" : ""}>{typed || " "}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2 h-4">
          {phase === "posting" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-credit animate-pulse" />
              <span className="font-mono text-[0.62rem] text-fog">FiNot mencatat…</span>
            </>
          )}
          {phase === "posted" && (
            <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] text-credit">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Tercatat ke buku besar
            </span>
          )}
        </div>
      </div>

      {/* Ledger region (paper) */}
      <div className="bg-paper m-2.5 rounded-lg overflow-hidden">
        <div className="flex items-baseline justify-between px-4 pt-3 pb-2 border-b border-paper-line">
          <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-paper-mut">
            Buku Besar · Jun 2026
          </span>
          <span className="font-mono text-[0.6rem] tnum text-paper-mut">
            Awal Rp{rp(SALDO_AWAL)}
          </span>
        </div>

        <div className="ledger-ruled divide-y divide-paper-line min-h-[10rem]">
          {rows.length === 0 && (
            <p className="font-mono text-[0.7rem] text-paper-mut px-4 py-6 text-center">
              Belum ada entri hari ini.
            </p>
          )}
          {rows.map((row, i) => (
            <LedgerRow key={i} row={row} fresh={!reduced && i === rows.length - 1} />
          ))}
        </div>

        <div className="flex items-baseline justify-between px-4 py-2.5 border-t-2 border-paper-ink/20">
          <span className="font-display text-sm font-semibold text-paper-ink">Saldo</span>
          <span
            key={rows.length}
            className={`font-mono text-base font-bold tnum text-paper-ink rounded px-1 ${
              !reduced && rows.length > 0 ? "animate-balance-tick" : ""
            }`}
          >
            Rp{rp(rows.length ? rows[rows.length - 1].saldo : SALDO_AWAL)}
          </span>
        </div>
      </div>
    </div>
  );
}
