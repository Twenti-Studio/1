import TransactionHistory from "./sections/TransactionHistory";

export default function TransactionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Riwayat Transaksi</h1>
        <p className="text-white/50 text-sm mt-1">
          Semua pencatatan pemasukan dan pengeluaranmu.
        </p>
      </div>
      <TransactionHistory />
    </div>
  );
}
