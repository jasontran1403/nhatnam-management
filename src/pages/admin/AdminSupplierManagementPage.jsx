// src/pages/admin/AdminSupplierManagementPage.jsx
import SupplierManagementShared from '../shared/SupplierManagementShared.jsx';

export default function AdminSupplierManagementPage() {
  return (
    <SupplierManagementShared basePath="/admin/suppliers" canManageCatalog />
  );
}
