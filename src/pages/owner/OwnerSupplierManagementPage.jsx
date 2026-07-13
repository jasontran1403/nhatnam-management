// src/pages/owner/OwnerSupplierManagementPage.jsx
import SupplierManagementShared from '../shared/SupplierManagementShared.jsx';

export default function OwnerSupplierManagementPage() {
  return (
    <SupplierManagementShared
      basePath="/owner/production/suppliers"
      dashboardPath="/owner/production"
      analysisPath="/owner/production/expense-categories"
      canManageCatalog
    />
  );
}