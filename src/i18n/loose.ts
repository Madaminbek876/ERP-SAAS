import { repairNestedStrings, repairTextEncoding } from "./repairEncoding"

export type LooseLanguageCode = "uz" | "ru" | "en"

type LocalizedPhrase = {
  uz: string
  ru: string
  en: string
}

type MatchMode = "exact" | "prefix" | "suffix"

type CompiledEntry = {
  phrase: LocalizedPhrase
  mode: MatchMode
  regexByLanguage: Record<LooseLanguageCode, RegExp>
}

const EXACT_PHRASES: LocalizedPhrase[] = [
  { uz: "Yopish", ru: "Закрыть", en: "Close" },
  { uz: "yopish", ru: "закрыть", en: "close" },
  { uz: "BIZNING TIZIM", ru: "НАША СИСТЕМА", en: "OUR SYSTEM" },
  { uz: "Ko'rsatish", ru: "Показать", en: "Show" },
  { uz: "Filtrlar", ru: "Фильтры", en: "Filters" },
  { uz: "Holati", ru: "Статус", en: "Status" },
  { uz: "Barchasi", ru: "Все", en: "All" },
  { uz: "Faqat aktiv", ru: "Только активные", en: "Active only" },
  { uz: "Faqat noaktiv", ru: "Только неактивные", en: "Inactive only" },
  { uz: "Qidiruv", ru: "Поиск", en: "Search" },
  { uz: "Saralash", ru: "Сортировка", en: "Sorting" },
  { uz: "Yangi dan eski", ru: "Сначала новые", en: "Newest first" },
  { uz: "Eski dan yangi", ru: "Сначала старые", en: "Oldest first" },
  { uz: "Tozalash", ru: "Очистить", en: "Clear" },
  { uz: "Qatorni tanlash", ru: "Выбрать строку", en: "Select row" },
  { uz: "Ko'rish", ru: "Просмотр", en: "View" },
  { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" },
  { uz: "O'chirish", ru: "Удалить", en: "Delete" },
  { uz: "Rows:", ru: "Строк:", en: "Rows:" },
  { uz: "Rasm qo'shish", ru: "Добавить изображение", en: "Add image" },
  { uz: "Tafsiya qilingan format", ru: "Рекомендуемый формат", en: "Recommended format" },
  { uz: "Maksimal hajm", ru: "Максимальный размер", en: "Maximum size" },
  { uz: "Preview", ru: "Предпросмотр", en: "Preview" },
  { uz: "Print", ru: "Печать", en: "Print" },
  { uz: "Print uchun tayyor ko'rinish", ru: "Версия для печати", en: "Print-ready view" },
  { uz: "Hujjat", ru: "Документ", en: "Document" },
  { uz: "Fayllar", ru: "Файлы", en: "Files" },
  { uz: "Fayl yo'q", ru: "Файлов нет", en: "No files" },
  { uz: "Reference", ru: "Ссылка", en: "Reference" },
  { uz: "Summa", ru: "Сумма", en: "Amount" },
  { uz: "Mas'ul", ru: "Ответственный", en: "Responsible" },
  { uz: "Izoh", ru: "Комментарий", en: "Note" },
  { uz: "Sana", ru: "Дата", en: "Date" },
  { uz: "Sarlavha", ru: "Заголовок", en: "Title" },
  { uz: "Kontragent", ru: "Контрагент", en: "Counterparty" },
  { uz: "Rahbar / Mas'ul", ru: "Руководитель / Ответственный", en: "Manager / Responsible" },
  { uz: "Qabul qiluvchi", ru: "Получатель", en: "Recipient" },
  { uz: "Imzo / Pechat", ru: "Подпись / Печать", en: "Signature / Seal" },
  { uz: "Upload: backendga ulaysiz (mock rejim)", ru: "Загрузка: подключается к бэкенду (mock-режим)", en: "Upload: connect it to the backend (mock mode)" },
  { uz: "Download: backend url bo'lsa ochiladi", ru: "Скачивание: откроется, если есть backend URL", en: "Download: opens if a backend URL exists" },
  { uz: "Auth background", ru: "Фон авторизации", en: "Auth background" },
  { uz: "Hisob-faktura", ru: "Счет-фактура", en: "Invoice" },
  { uz: "Shartnoma", ru: "Договор", en: "Contract" },
  { uz: "Dalolatnoma (Akt)", ru: "Акт", en: "Act" },
  { uz: "To'lov topshirig'i", ru: "Платежное поручение", en: "Payment order" },
  { uz: "Yuk xati", ru: "Товарная накладная", en: "Delivery note" },
  { uz: "Inventarizatsiya akti", ru: "Акт инвентаризации", en: "Inventory act" },
  { uz: "Ishlab chiqarish hisobot", ru: "Производственный отчет", en: "Production report" },
  { uz: "Boshqa", ru: "Другое", en: "Other" },
  { uz: "Imzolangan", ru: "Подписано", en: "Signed" },
  { uz: "Bekor qilingan", ru: "Отменено", en: "Canceled" },
  { uz: "Arxiv", ru: "Архив", en: "Archived" },
  { uz: "Buyurtma", ru: "Заказ", en: "Order" },
  { uz: "Buyurtmalar", ru: "Заказы", en: "Orders" },
  { uz: "Buyurtmalar ro'yxati", ru: "Список заказов", en: "Orders list" },
  { uz: "Buyurtma raqami", ru: "Номер заказа", en: "Order number" },
  { uz: "Buyurtma sana", ru: "Дата заказа", en: "Order date" },
  { uz: "Buyurtma sanasi", ru: "Дата заказа", en: "Order date" },
  { uz: "To'lanmagan buyurtmalar", ru: "Неоплаченные заказы", en: "Unpaid orders" },
  { uz: "Xarid", ru: "Покупка", en: "Purchase" },
  { uz: "Ishlab chiqarish", ru: "Производство", en: "Production" },
  { uz: "Ombor", ru: "Склад", en: "Warehouse" },
  { uz: "Moliya", ru: "Финансы", en: "Finance" },
  { uz: "Manual", ru: "Ручной", en: "Manual" },
  { uz: "Order Detail", ru: "Детали заказа", en: "Order Detail" },
  { uz: "Buyurtma detail", ru: "Детали заказа", en: "Order details" },
  { uz: "Buyurtma yuklanmoqda...", ru: "Заказ загружается...", en: "Loading order..." },
  { uz: "Buyurtma detailini yuklab bo'lmadi.", ru: "Не удалось загрузить детали заказа.", en: "Failed to load order details." },
  { uz: "Buyurtma topilmadi.", ru: "Заказ не найден.", en: "Order not found." },
  { uz: "Buyurtma tarkibi va to'lov holati", ru: "Состав заказа и статус оплаты", en: "Order contents and payment status" },
  { uz: "Orqaga", ru: "Назад", en: "Back" },
  { uz: "Yangilash", ru: "Обновить", en: "Refresh" },
  { uz: "Yetkazish manzili ko'rsatilmagan", ru: "Адрес доставки не указан", en: "Delivery address not specified" },
  { uz: "Jami summa", ru: "Общая сумма", en: "Total amount" },
  { uz: "To'langan", ru: "Оплачено", en: "Paid" },
  { uz: "Qoldiq", ru: "Остаток", en: "Remaining" },
  { uz: "Yetkazish sanasi", ru: "Дата доставки", en: "Delivery date" },
  { uz: "Actions", ru: "Действия", en: "Actions" },
  { uz: "Edit header", ru: "Редактировать шапку", en: "Edit header" },
  { uz: "Confirm", ru: "Подтвердить", en: "Confirm" },
  { uz: "Set status", ru: "Изменить статус", en: "Set status" },
  { uz: "Cancel", ru: "Отменить", en: "Cancel" },
  { uz: "Add payment", ru: "Добавить платеж", en: "Add payment" },
  { uz: "Add item", ru: "Добавить позицию", en: "Add item" },
  { uz: "Ship", ru: "Отгрузить", en: "Ship" },
  { uz: "Deliver", ru: "Доставить", en: "Deliver" },
  { uz: "Recalc", ru: "Пересчитать", en: "Recalculate" },
  { uz: "Items", ru: "Позиции", en: "Items" },
  { uz: "Umumiy", ru: "Итого", en: "Total" },
  { uz: "Nomi", ru: "Название", en: "Name" },
  { uz: "Miqdor", ru: "Количество", en: "Quantity" },
  { uz: "Narx", ru: "Цена", en: "Price" },
  { uz: "NDS %", ru: "НДС %", en: "VAT %" },
  { uz: "Jami", ru: "Итого", en: "Total" },
  { uz: "Delete", ru: "Удалить", en: "Delete" },
  { uz: "Reserve", ru: "Резервировать", en: "Reserve" },
  { uz: "Return", ru: "Возврат", en: "Return" },
  { uz: "Bu buyurtma ichida pozitsiyalar topilmadi.", ru: "В этом заказе позиции не найдены.", en: "No items were found in this order." },
  { uz: "Payments", ru: "Платежи", en: "Payments" },
  { uz: "To'lovlar hali yo'q.", ru: "Платежей пока нет.", en: "No payments yet." },
  { uz: "Reservations", ru: "Резервы", en: "Reservations" },
  { uz: "Lokatsiya", ru: "Локация", en: "Location" },
  { uz: "Izoh yo'q", ru: "Комментария нет", en: "No note" },
  { uz: "Unreserve", ru: "Снять резерв", en: "Unreserve" },
  { uz: "Rezervlar hali yo'q.", ru: "Резервов пока нет.", en: "No reservations yet." },
  { uz: "Status History", ru: "История статусов", en: "Status History" },
  { uz: "Status tarixi hali yo'q.", ru: "Истории статусов пока нет.", en: "No status history yet." },
  { uz: "Itemni o'chiraymi?", ru: "Удалить позицию?", en: "Delete item?" },
  { uz: "Bekor qilish sababini kiriting", ru: "Введите причину отмены", en: "Enter cancellation reason" },
  { uz: "Amal bajarilmadi", ru: "Не удалось выполнить действие", en: "Action failed" },
  { uz: "Order date (YYYY-MM-DD)", ru: "Дата заказа (YYYY-MM-DD)", en: "Order date (YYYY-MM-DD)" },
  { uz: "Delivery date (YYYY-MM-DD yoki bo'sh)", ru: "Дата доставки (YYYY-MM-DD или пусто)", en: "Delivery date (YYYY-MM-DD or empty)" },
  { uz: "Currency", ru: "Валюта", en: "Currency" },
  { uz: "Discount total", ru: "Сумма скидки", en: "Discount total" },
  { uz: "Delivery address", ru: "Адрес доставки", en: "Delivery address" },
  { uz: "Courier name", ru: "Имя курьера", en: "Courier name" },
  { uz: "Buyurtma yangilandi", ru: "Заказ обновлен", en: "Order updated" },
  { uz: "Izoh (ixtiyoriy)", ru: "Комментарий (необязательно)", en: "Note (optional)" },
  { uz: "Status yangilandi", ru: "Статус обновлен", en: "Status updated" },
  { uz: "Buyurtma bekor qilindi", ru: "Заказ отменен", en: "Order canceled" },
  { uz: "Method: CASH, CARD, BANK_TRANSFER", ru: "Метод: CASH, CARD, BANK_TRANSFER", en: "Method: CASH, CARD, BANK_TRANSFER" },
  { uz: "Amount", ru: "Сумма", en: "Amount" },
  { uz: "Note", ru: "Комментарий", en: "Note" },
  { uz: "To'lov qo'shildi", ru: "Платеж добавлен", en: "Payment added" },
  { uz: "Product id noto'g'ri", ru: "Неверный ID товара", en: "Invalid product ID" },
  { uz: "Bu product orderda allaqachon mavjud. Mavjud qatorni tahrir qiling.", ru: "Этот товар уже есть в заказе. Отредактируйте существующую строку.", en: "This product is already in the order. Edit the existing row." },
  { uz: "Qty (masalan 2.000000)", ru: "Кол-во (например, 2.000000)", en: "Qty (e.g. 2.000000)" },
  { uz: "Unit price", ru: "Цена за единицу", en: "Unit price" },
  { uz: "NDS rate (0.12 = 12%)", ru: "Ставка НДС (0.12 = 12%)", en: "VAT rate (0.12 = 12%)" },
  { uz: "Item qo'shildi", ru: "Позиция добавлена", en: "Item added" },
  { uz: "Qty", ru: "Кол-во", en: "Qty" },
  { uz: "Item yangilandi", ru: "Позиция обновлена", en: "Item updated" },
  { uz: "Rezerv qty", ru: "Кол-во резерва", en: "Reserve qty" },
  { uz: "Rezerv qo'yildi", ru: "Резерв установлен", en: "Reservation added" },
  { uz: "Return qty", ru: "Кол-во возврата", en: "Return qty" },
  { uz: "Qaytarish rasmiylashtirildi", ru: "Возврат оформлен", en: "Return registered" },
  { uz: "Buyurtma jo'natildi", ru: "Заказ отгружен", en: "Order shipped" },
  { uz: "Buyurtma tasdiqlandi", ru: "Заказ подтвержден", en: "Order confirmed" },
  { uz: "Buyurtma yetkazildi", ru: "Заказ доставлен", en: "Order delivered" },
  { uz: "Total qayta hisoblandi", ru: "Итог пересчитан", en: "Total recalculated" },
  { uz: "Qisman to'langan", ru: "Частично оплачено", en: "Partially paid" },
  { uz: "To'lanmagan", ru: "Не оплачено", en: "Unpaid" },
  { uz: "Backend holati", ru: "Состояние бэкенда", en: "Backend status" },
  { uz: "Endpointlar sinxronlanyapti", ru: "Эндпоинты синхронизируются", en: "Endpoints are syncing" },
  { uz: "Real ma'lumot oqimi faol", ru: "Поток реальных данных активен", en: "Real data flow is active" },
  { uz: "Backend javobi yo'q", ru: "Нет ответа от бэкенда", en: "No backend response" },
  { uz: "Qisman warning bor", ru: "Есть частичное предупреждение", en: "There is a partial warning" },
  { uz: "Cashflow trend", ru: "Тренд денежного потока", en: "Cashflow trend" },
  { uz: "Majburiyatlar paneli", ru: "Панель обязательств", en: "Obligations panel" },
  { uz: "Payment mix", ru: "Структура платежей", en: "Payment mix" },
  { uz: "Kategoriya kesimi", ru: "Срез по категориям", en: "Category breakdown" },
  { uz: "Nazorat signallari", ru: "Сигналы контроля", en: "Control signals" },
  { uz: "Recent activity", ru: "Последняя активность", en: "Recent activity" },
  { uz: "Live feed", ru: "Живая лента", en: "Live feed" },
  { uz: "Bu filtr bo'yicha activity topilmadi.", ru: "По этому фильтру активность не найдена.", en: "No activity found for this filter." },
  { uz: "Syncing", ru: "Синхронизация", en: "Syncing" },
  { uz: "Finance live", ru: "Финансы онлайн", en: "Finance live" },
  { uz: "Backend required", ru: "Нужен бэкенд", en: "Backend required" },
  { uz: "Moliya boshqaruv markazi", ru: "Центр управления финансами", en: "Finance control center" },
  { uz: "Kirim, xarajat, qarzdorlik, payroll va bank oqimini bitta ekran ichida kuzatish uchun qayta yig'ilgan dashboard. Asosiy bloklar real finance endpointlardan oziqlanadi va manba holati shu yerning o'zida ko'rsatiladi.", ru: "Пересобранный дашборд для отслеживания поступлений, расходов, задолженности, payroll и банковских потоков на одном экране. Основные блоки получают данные из реальных finance endpoints, а состояние источников показано здесь же.", en: "A rebuilt dashboard to track income, expenses, debts, payroll, and bank flow on a single screen. Core sections use real finance endpoints, and source status is shown right here." },
  { uz: "Client, supplier, note yoki method...", ru: "Клиент, поставщик, комментарий или метод...", en: "Client, supplier, note or method..." },
  { uz: "Davrni tanlang", ru: "Выберите период", en: "Select range" },
  { uz: "Sof oqim snapshot", ru: "Снимок чистого потока", en: "Net flow snapshot" },
  { uz: "Debitorlar, kreditorlar va payroll qoldig'i birga hisoblanib, moliyaviy bosim nuqtalari ajratib ko'rsatildi.", ru: "Дебиторка, кредиторка и остаток payroll посчитаны вместе, чтобы отдельно показать точки финансового давления.", en: "Receivables, payables, and payroll balance are grouped together to highlight financial pressure points." },
  { uz: "Receivables", ru: "Дебиторка", en: "Receivables" },
  { uz: "Payables", ru: "Кредиторка", en: "Payables" },
  { uz: "Payroll due", ru: "Задолженность по payroll", en: "Payroll due" },
  { uz: "Dashboard backenddan o'qilmadi", ru: "Не удалось получить данные дашборда из бэкенда", en: "Dashboard data could not be read from the backend" },
  { uz: "Team + control", ru: "Команда + контроль", en: "Team + control" },
  { uz: "Payroll va compliance uchun tezkor ko'rinish", ru: "Быстрый обзор payroll и compliance", en: "Quick view for payroll and compliance" },
  { uz: "Payroll backlog", ru: "Отставание по payroll", en: "Payroll backlog" },
  { uz: "Xodimlar bo'yicha joriy oyda hali yopilmagan summa. Payroll bo'limiga o'tmasdan ham bosim darajasini ko'rish mumkin.", ru: "Сумма по сотрудникам, которая еще не закрыта в текущем месяце. Уровень давления можно увидеть, не переходя в раздел payroll.", en: "The amount still unsettled for employees this month. You can see the pressure level without opening the payroll section." },
  { uz: "Collection ratio", ru: "Коэффициент инкассации", en: "Collection ratio" },
  { uz: "Mijozlardan pul qaytishi darajasi", ru: "Уровень возврата денег от клиентов", en: "Client collection rate" },
  { uz: "Source coverage", ru: "Покрытие источников", en: "Source coverage" },
  { uz: "Summary, debt, ledger, payments va employee oqimlari real vaqtga yaqin ko'rinishda yig'iladi.", ru: "Потоки summary, debt, ledger, payments и employee собираются почти в реальном времени.", en: "Summary, debt, ledger, payments, and employee flows are aggregated in near real time." },
  { uz: "Bank", ru: "Банк", en: "Bank" },
  { uz: "Karta", ru: "Карта", en: "Card" },
  { uz: "Naqd", ru: "Наличные", en: "Cash" },
  { uz: "Kirim", ru: "Поступление", en: "Income" },
  { uz: "Xarajat", ru: "Расход", en: "Expense" },
  { uz: "Tuzatish", ru: "Корректировка", en: "Adjustment" },
  { uz: "Kassa hujjatlari", ru: "Кассовые документы", en: "Cash documents" },
  { uz: "Kassa bo'yicha har qanday kirim yoki chiqim bo'lganini shu yerga kiritasiz!", ru: "Здесь вы вносите любые поступления и расходы по кассе!", en: "Enter any cash income or expense here!" },
  { uz: "Turi", ru: "Тип", en: "Type" },
  { uz: "Created at", ru: "Создано", en: "Created at" },
  { uz: "Yangi kassoviy dokument", ru: "Новый кассовый документ", en: "New cash document" },
  { uz: "Category", ru: "Категория", en: "Category" },
  { uz: "Order", ru: "Заказ", en: "Order" },
  { uz: "Purchase", ru: "Покупка", en: "Purchase" },
  { uz: "Salary", ru: "Зарплата", en: "Salary" },
  { uz: "Employee to'lov turi", ru: "Тип выплаты сотруднику", en: "Employee payment type" },
  { uz: "Avans", ru: "Аванс", en: "Advance" },
  { uz: "Oylik", ru: "Зарплата", en: "Salary" },
  { uz: "Bonus", ru: "Бонус", en: "Bonus" },
  { uz: "Valyuta", ru: "Валюта", en: "Currency" },
  { uz: "Method", ru: "Метод", en: "Method" },
  { uz: "Kassoviy dokumentni tahrirlash", ru: "Редактировать кассовый документ", en: "Edit cash document" },
  { uz: "Bank hujjatlari", ru: "Банковские документы", en: "Bank documents" },
  { uz: "Bu yerda siz bank orqali otkazilgan to'lovlarni nazorat qila olasiz", ru: "Здесь вы можете контролировать платежи, проведенные через банк", en: "Here you can monitor payments made through the bank" },
  { uz: "Yangi bankskiy dokument", ru: "Новый банковский документ", en: "New bank document" },
  { uz: "method", ru: "метод", en: "method" },
  { uz: "amount", ru: "сумма", en: "amount" },
  { uz: "currency", ru: "валюта", en: "currency" },
  { uz: "occurred_on", ru: "дата операции", en: "occurred_on" },
  { uz: "note", ru: "комментарий", en: "note" },
  { uz: "Bankskiy dokumentni tahrirlash", ru: "Редактировать банковский документ", en: "Edit bank document" },
  { uz: "Dollar kurs qo'shish", ru: "Добавить курс доллара", en: "Add dollar rate" },
  { uz: "Kurslar jadvali", ru: "Таблица курсов", en: "Rates table" },
  { uz: "Oxirgi kurslar", ru: "Последние курсы", en: "Latest rates" },
  { uz: "Kurs", ru: "Курс", en: "Rate" },
  { uz: "Manba", ru: "Источник", en: "Source" },
  { uz: "Status", ru: "Статус", en: "Status" },
  { uz: "Joriy aktiv kurs", ru: "Текущий активный курс", en: "Current active rate" },
  { uz: "Yangi kurs qo'shish", ru: "Добавить новый курс", en: "Add new rate" },
  { uz: "rate", ru: "курс", en: "rate" },
  { uz: "date", ru: "дата", en: "date" },
  { uz: "source", ru: "источник", en: "source" },
  { uz: "Xodimlar oyligi", ru: "Зарплата сотрудников", en: "Employee payroll" },
  { uz: "Oylik reyestri", ru: "Реестр зарплаты", en: "Payroll register" },
  { uz: "Xodim", ru: "Сотрудник", en: "Employee" },
  { uz: "Bo'lim", ru: "Отдел", en: "Department" },
  { uz: "Amal", ru: "Действие", en: "Action" },
  { uz: "Ish haqi to'lovini yaratish", ru: "Создать выплату зарплаты", en: "Create salary payment" },
  { uz: "Xodimni tanlang", ru: "Выберите сотрудника", en: "Select employee" },
  { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type" },
  { uz: "O'tkazmalar", ru: "Проводки", en: "Entries" },
  { uz: "Ro'yxati", ru: "Список", en: "List" },
  { uz: "O'tkazmalarni filtrlash", ru: "Фильтрация проводок", en: "Filter entries" },
  { uz: "Boshlanish sana", ru: "Дата начала", en: "Start date" },
  { uz: "Tugash sana", ru: "Дата окончания", en: "End date" },
  { uz: "O'tkazma turi", ru: "Тип проводки", en: "Entry type" },
  { uz: "To'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  { uz: "Bank o'tkazma", ru: "Банковский перевод", en: "Bank transfer" },
  { uz: "Reference turi", ru: "Тип ссылки", en: "Reference type" },
  { uz: "Reference ID", ru: "ID ссылки", en: "Reference ID" },
  { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading..." },
  { uz: "To'lov", ru: "Платеж", en: "Payment" },
  { uz: "Ismi", ru: "Имя", en: "Name" },
  { uz: "Kirim / Xarajat / Tuzatish", ru: "Поступление / Расход / Корректировка", en: "Income / Expense / Adjustment" },
  { uz: "Tanlang...", ru: "Выберите...", en: "Select..." },
  { uz: "Kassoviy dokument o'chirilsinmi?", ru: "Удалить кассовый документ?", en: "Delete the cash document?" },
  { uz: "Bankskiy dokument o'chirilsinmi?", ru: "Удалить банковский документ?", en: "Delete the bank document?" },
  { uz: "Kassoviy dokument", ru: "Кассовый документ", en: "Cash document" },
  { uz: "Bankskiy dokument", ru: "Банковский документ", en: "Bank document" },
  { uz: "Katalogni ochish", ru: "Открыть каталог", en: "Open catalog" },
  { uz: "Sana bo'yicha filtrlash:", ru: "Фильтр по дате:", en: "Filter by date:" },
  { uz: "Payroll snapshot tayyorlanmoqda", ru: "Снимок payroll готовится", en: "Payroll snapshot is being prepared" },
]

const PREFIX_PHRASES: LocalizedPhrase[] = [
  { uz: "Buyurtma ", ru: "Заказ ", en: "Order " },
  { uz: "Yangilandi:", ru: "Обновлено:", en: "Updated:" },
  { uz: "Manzil:", ru: "Адрес:", en: "Address:" },
  { uz: "Kirim:", ru: "Поступление:", en: "Income:" },
  { uz: "Xarajat:", ru: "Расход:", en: "Expense:" },
  { uz: "Net:", ru: "Чистый поток:", en: "Net:" },
  { uz: "Salom,", ru: "Привет,", en: "Hello," },
  { uz: "Qatorni tanlash ", ru: "Выбрать строку ", en: "Select row " },
  { uz: "select warehouse ", ru: "выбрать склад ", en: "select warehouse " },
  { uz: "Client id kiriting.", ru: "Введите ID клиента.", en: "Enter client ID." },
  { uz: "Product id kiriting.", ru: "Введите ID товара.", en: "Enter product ID." },
  { uz: "Location id kiriting.", ru: "Введите ID локации.", en: "Enter location ID." },
  { uz: "Ship location id.", ru: "Введите ID локации отгрузки.", en: "Enter ship location ID." },
]

const SUFFIX_PHRASES: LocalizedPhrase[] = [
  { uz: "sanasidagi buyurtma", ru: "по заказу от этой даты", en: "dated order" },
  { uz: "ta pozitsiya", ru: "позиций", en: "items" },
  { uz: "ta qator", ru: "строк", en: "rows" },
  { uz: "bo'yicha ma'lumot topilmadi", ru: "данные не найдены", en: "data not found" },
  { uz: "yangilanmoqda", ru: "обновляется", en: "is updating" },
  { uz: "tayyorlanmoqda", ru: "готовится", en: "is preparing" },
  { uz: "bo'yicha kirim va xarajat oqimi", ru: "по потоку поступлений и расходов", en: "for income and expense flow" },
  { uz: "xodim", ru: "сотрудник", en: "employee" },
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function phrasePattern(value: string) {
  return escapeRegExp(value.trim())
    .replace(/['’‘`ʼʻ]/g, "['’‘`ʼʻ]")
    .replace(/\s+/g, "\\s+")
}

function compileEntries(phrases: LocalizedPhrase[], mode: MatchMode): CompiledEntry[] {
  return phrases.map((phrase) => ({
    phrase,
    mode,
    regexByLanguage: {
      uz: createRegex(phrase.uz, mode),
      ru: createRegex(phrase.ru, mode),
      en: createRegex(phrase.en, mode),
    },
  }))
}

function createRegex(value: string, mode: MatchMode) {
  const body = phrasePattern(value)
  if (mode === "exact") return new RegExp(`^${body}$`, "u")
  if (mode === "prefix") return new RegExp(`^(${body})([\\s\\S]*)$`, "u")
  return new RegExp(`^([\\s\\S]*?)(${body})$`, "u")
}

const normalizedExactPhrases = repairNestedStrings(EXACT_PHRASES)
const normalizedPrefixPhrases = repairNestedStrings(PREFIX_PHRASES)
const normalizedSuffixPhrases = repairNestedStrings(SUFFIX_PHRASES)

const EXACT_ENTRIES = compileEntries(normalizedExactPhrases, "exact")
const PREFIX_ENTRIES = compileEntries(normalizedPrefixPhrases, "prefix")
const SUFFIX_ENTRIES = compileEntries(normalizedSuffixPhrases, "suffix")

function preserveWhitespace(original: string, nextCore: string) {
  const leading = original.match(/^\s*/)?.[0] ?? ""
  const trailing = original.match(/\s*$/)?.[0] ?? ""
  return `${leading}${nextCore}${trailing}`
}

function translateCore(value: string, language: LooseLanguageCode) {
  for (const entry of EXACT_ENTRIES) {
    if (entry.regexByLanguage.uz.test(value) || entry.regexByLanguage.ru.test(value) || entry.regexByLanguage.en.test(value)) {
      return repairTextEncoding(entry.phrase[language])
    }
  }

  for (const entry of PREFIX_ENTRIES) {
    const match =
      value.match(entry.regexByLanguage.uz) ||
      value.match(entry.regexByLanguage.ru) ||
      value.match(entry.regexByLanguage.en)
    if (match) return `${repairTextEncoding(entry.phrase[language])}${match[2] || ""}`
  }

  for (const entry of SUFFIX_ENTRIES) {
    const match =
      value.match(entry.regexByLanguage.uz) ||
      value.match(entry.regexByLanguage.ru) ||
      value.match(entry.regexByLanguage.en)
    if (match) return `${match[1] || ""}${repairTextEncoding(entry.phrase[language])}`
  }

  return value
}

export function translateLooseText(value: string, language: LooseLanguageCode) {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed) return value

  return preserveWhitespace(value, translateCore(trimmed, language))
}
