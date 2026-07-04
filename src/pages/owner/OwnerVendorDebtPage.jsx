// src/pages/owner/OwnerVendorDebtPage.jsx
import VendorDebtShared from '../shared/VendorDebtShared.jsx';

export default function OwnerVendorDebtPage() {
  return (
    <VendorDebtShared
      basePath="/owner/production/vendor-debts"
      canCreateExpense={false}
      dashboardPath="/owner/production"
      paymentHistoryPath="/owner/expenses"
    />
  );
}
