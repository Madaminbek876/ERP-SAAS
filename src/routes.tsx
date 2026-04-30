import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import LoginPage from "./pages/auth/LoginPage"
import ProtectedRoute from "./pages/auth/ProtectedRoute"
import PublicOnlyRoute from "./pages/auth/PublicOnlyRoute"
import OverviewDashboardPage from "./pages/Dashboard/overview/OverviewDashboardPage"
import SotuvDashboardPage from "./pages/sotuv/SotuvDashboardPage"
import SkladDashboardPage from "./pages/sklad/SkladDashboardPage"

import MoliyaLayout from "./pages/moliya/MoliyaLayout"
import MoliyaDashboardContent from "./pages/moliya/Dashboard/MoliyaDashboardContent"
import MoliyaClientDebtsPage from "./pages/moliya/Debts/MoliyaClientDebtsPage"
import {
  MoliyaBankDocumentsPage,
  MoliyaCashDocumentsPage,
  MoliyaPayrollPage,
} from "./pages/moliya/MoliyaWorkspaces"

import WarehouseLayout from "./pages/sklad/warehouse/WarehouseLayout"
import StockOnHandPage from "./pages/sklad/stock/StockOnHandPage"
import WarehouseMovementsPage from "./pages/sklad/warehouse/movements/WarehouseMovementsPage"
import WarehouseInventoryPage from "./pages/sklad/warehouse/inventory/WarehouseInventoryPage"
import WarehouseInternalOrdersPage from "./pages/sklad/warehouse/internal-orders/WarehouseInternalOrdersPage"

import Xodimlar from "./pages/xodimlar/Employee/Xodimlar"
import TabsCrudTS from "./pages/xodimlar/TabsCrud"

import DictsSettingsPage from "./pages/Settings/DictsSettingsPage"
import ProductsPage from "./pages/catalog/ProductsPage"
import XodimlarTable from "./pages/xodimlar/Employee/XodimlarTable"

import OrdersPage from "./pages/orders/OrdersPage"
import OrderDetailPage from "./pages/orders/OrderDetailPage"
import OrderShipmentsPage from "./pages/orders/OrderShipmentsPage"
import OrderCreatePage from "./pages/orders/components/OrderCreatePage"

import PurchasesListPage from "./pages/purchases/PurchasesListPage"
import PurchaseDetailPage from "./pages/purchases/PurchaseDetailPage"

import ProfilePage from "./pages/profile/profile"

import WarehouseTransferPage from "./pages/sklad/warehouse/actions/WarehouseTransferPage"
import WarehouseWriteOffPage from "./pages/sklad/warehouse/actions/WarehouseWriteOffPage"
import WarehouseReceiptPage from "./pages/sklad/warehouse/actions/WarehouseReceiptPage"
import WarehousesPage from "./pages/sklad/warehouse/warehouses/WarehousesPage"
import {
  WarehouseInventoryDetailPage,
  WarehouseTransferDetailPage,
  WarehouseWriteOffDetailPage,
} from "./pages/sklad/warehouse/details/WarehouseDocumentDetailPage"

import AuthLayout from "./layouts/AuthLayout"
import NotificationsPage from "./pages/notifications/NotificationsPage"

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: <OverviewDashboardPage /> },
          { path: "dashboard/sotuv", element: <SotuvDashboardPage /> },
          { path: "dashboard/sklad", element: <SkladDashboardPage /> },

          { path: "dashboard/settings/dicts", element: <DictsSettingsPage /> },
          { path: "dashboard/catalog/products", element: <ProductsPage /> },

          { path: "dashboard/notifications", element: <NotificationsPage /> },

          { path: "dashboard/purchases", element: <Navigate to="/dashboard/sklad/warehouse/purchases" replace /> },
          { path: "dashboard/purchases/:id", element: <PurchaseDetailPage /> },

          {
            path: "dashboard/moliya",
            element: <MoliyaLayout />,
            children: [
              { index: true, element: <MoliyaDashboardContent /> },
              { path: "dashboard", element: <Navigate to="/dashboard/moliya" replace /> },
              { path: "cash-documents", element: <MoliyaCashDocumentsPage /> },
              { path: "bank-documents", element: <MoliyaBankDocumentsPage /> },
              { path: "payroll", element: <MoliyaPayrollPage /> },
              { path: "debts", element: <MoliyaClientDebtsPage /> },
              { path: "ledger", element: <Navigate to="/dashboard/moliya/cash-documents" replace /> },
              { path: "add-entry", element: <Navigate to="/dashboard/moliya/cash-documents" replace /> },
              { path: "employees", element: <Navigate to="/dashboard/moliya/payroll" replace /> },
            ],
          },

          {
            path: "dashboard/sklad",
            element: <Outlet />,
            children: [
              { index: true, element: <SkladDashboardPage /> },
              {
                path: "warehouse",
                element: <WarehouseLayout />,
                children: [
                  { index: true, element: <Navigate to="balances-products" replace /> },
                  { path: "receipts", element: <WarehouseReceiptPage /> },
                  { path: "write-offs", element: <WarehouseWriteOffPage /> },
                  { path: "write-offs/:id", element: <WarehouseWriteOffDetailPage /> },
                  { path: "transfers", element: <WarehouseTransferPage /> },
                  { path: "transfers/:id", element: <WarehouseTransferDetailPage /> },
                  { path: "inventories", element: <WarehouseInventoryPage /> },
                  { path: "inventories/:id", element: <WarehouseInventoryDetailPage /> },
                  { path: "internal-orders", element: <WarehouseInternalOrdersPage /> },
                  { path: "internal-orders/:id", element: <WarehouseTransferDetailPage /> },
                  { path: "balances-products", element: <StockOnHandPage initialItemType="FINISHED_PRODUCT" /> },
                  { path: "balances-materials", element: <StockOnHandPage initialItemType="RAW_MATERIAL" /> },
                  { path: "balances", element: <Navigate to="balances-products" replace /> },
                  { path: "stock", element: <Navigate to="balances-products" replace /> },
                  { path: "receipt", element: <Navigate to="receipts" replace /> },
                  { path: "transfer", element: <Navigate to="transfers" replace /> },
                  { path: "writeoff", element: <Navigate to="write-offs" replace /> },
                  { path: "movements", element: <WarehouseMovementsPage /> },
                  { path: "inventory", element: <Navigate to="inventories" replace /> },
                  { path: "purchases", element: <PurchasesListPage /> },
                  { path: "purchases/:id", element: <PurchaseDetailPage /> },
                  { path: "products", element: <ProductsPage /> },
                  { path: "warehouses", element: <WarehousesPage /> },
                ],
              },
            ],
          },

          {
            path: "sotuv",
            element: <Outlet />,
            children: [
              { index: true, element: <Navigate to="orders" replace /> },
              { path: "orders", element: <OrdersPage /> },
              { path: "orders/shipments", element: <OrderShipmentsPage /> },
              { path: "orders/:id", element: <OrderDetailPage /> },
              { path: "orders/new", element: <OrderCreatePage /> },
            ],
          },

          {
            path: "xodimlar",
            element: <Outlet />,
            children: [
              { index: true, element: <TabsCrudTS /> },
              { path: "form", element: <Xodimlar /> },
              { path: "employees", element: <XodimlarTable /> },
            ],
          },
        ],
      },

      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/", element: <LoginPage /> },
          { path: "/login", element: <LoginPage /> },
        ],
      },
    ],
  },
])
