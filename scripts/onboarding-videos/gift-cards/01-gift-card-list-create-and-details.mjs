// Gift cards · 01: the gift card list, creating one gift card, and its page.
//   node scripts/onboarding-videos/gift-cards/01-gift-card-list-create-and-details.mjs
import { createClient } from "@supabase/supabase-js";
import { record } from "../lib/recorder.mjs";

const DEMO_PHONE = "+61400555205"; // Mia Nguyen from demo-data.mjs, who has no gift card yet

/** Innermost element that contains every given text. */
const box = (page, ...texts) => texts.reduce((loc, t) => loc.filter({ has: page.getByText(t, { exact: true }) }), page.locator("body *")).last();

await record({
  folder: "gift-cards",
  file: "01-gift-card-list-create-and-details",
  title: "Danh sách thẻ quà tặng, tạo thẻ và xem chi tiết",
  voice: "Ngọc Lan", // female · south · soft and calm
  speed: 1,
  captions: "both", // "both" | "screen" | "srt" | "none"
  start: "/admin",
  warmUp: ["/admin", "/admin/gift-cards"],

  // Re-recordable: take back the gift card an earlier take created for Mia.
  async prepare() {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const { data: mia } = await db.from("customers").select("id").eq("phone", DEMO_PHONE).single();
    if (!mia) throw new Error("Run `node scripts/onboarding-videos/demo-data.mjs seed` first.");
    const { data: cards } = await db.from("gift_cards").select("id").eq("customer_id", mia.id);
    const ids = cards.map((c) => c.id);
    if (ids.length) {
      await db.from("gift_card_transactions").delete().in("gift_card_id", ids);
      await db.from("gift_cards").delete().in("id", ids);
    }
  },

  steps: [
    {
      say: "Video này hướng dẫn cách xem danh sách thẻ quà tặng, tạo một thẻ mới và xem chi tiết thẻ.",
    },
    {
      say: "Trong trang quản lý, bấm Gift cards ở thanh bên trái.",
      async run(h) {
        await h.sleep(1200);
        await h.click(h.page.getByRole("link", { name: "Gift cards" }).first());
        await h.page.waitForURL(/gift-cards/);
      },
    },
    {
      say: "Phía trên là tổng số tiền còn lại trên các thẻ, số thẻ đang dùng được, và số tiền thẻ bán trong tháng này.",
      async run(h) {
        await h.highlight(box(h.page, "Unused credit", "Active gift cards"));
      },
    },
    {
      say: "Danh sách mở ở tab Active, là các thẻ đang dùng được. Các tab khác lọc theo trạng thái: chưa bán, đã dùng hết, hết hạn, hoặc bị khoá.",
      async run(h) {
        await h.highlight(h.page.getByRole("link", { name: /^Active/ }).first());
        await h.sleep(3800);
        await h.highlight(h.page.locator("nav ul").filter({ has: h.page.getByRole("link", { name: /^Blocked/ }) }));
      },
    },
    {
      say: "Mỗi dòng có mã thẻ, tên khách, số dư còn lại và ngày hết hạn. Bấm vào dòng nào để mở thẻ đó.",
      async run(h) {
        await h.highlight(h.page.getByRole("table").first());
      },
    },
    {
      say: "Ô tìm kiếm tìm theo mã thẻ, tên hoặc số điện thoại của khách.",
      async run(h) {
        await h.unhighlight();
        const search = h.page.getByPlaceholder("Code, name or phone");
        await h.type(search, "Linh");
        await h.sleep(2200);
        await search.fill("");
      },
    },
    {
      say: "Để bán một thẻ mới, bấm Create gift card.",
      async run(h) {
        await h.sleep(1300);
        await h.click(h.page.getByRole("button", { name: "Create gift card", exact: true }));
        await h.page.getByRole("dialog", { name: "Create a gift card" }).waitFor();
      },
    },
    {
      say: "Chọn số tiền khách mua, ví dụ một trăm đô. Nếu là số khác, gõ vào ô Other.",
      async run(h) {
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.click(d.getByRole("button", { name: "$100", exact: true }));
        await h.sleep(2200);
        await h.moveTo(d.getByLabel("Other amount in whole dollars"));
      },
    },
    {
      say: "Bấm Generate để tạo mã thẻ. Nếu dùng thẻ đã in sẵn, gõ số in trên thẻ vào ô này.",
      async run(h) {
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.click(d.getByRole("button", { name: "Generate" }));
        await h.sleep(1500);
        await h.highlight(d.getByLabel("Code"));
      },
    },
    {
      say: "Nhập số điện thoại nếu muốn gắn thẻ với khách. Không bắt buộc, có thể để trống.",
      async run(h) {
        await h.unhighlight();
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.type(d.getByLabel(/Customer phone/), "0400555205");
      },
    },
    {
      say: "Thẻ có hạn ba năm. Có thể đổi ngày nếu cần.",
      async run(h) {
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.highlight(d.getByLabel(/Valid until/));
      },
    },
    {
      say: "Bên trái là hình thẻ sẽ in ra.",
      async run(h) {
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.highlight(d.locator("[data-printed-gift-card]").first());
      },
    },
    {
      say: "Bấm Create để lưu thẻ. App chỉ ghi lại thẻ, nên nhớ thu tiền ở quầy như bình thường.",
      async run(h) {
        await h.unhighlight();
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.click(d.getByRole("button", { name: /^Create \$100 gift card$/ }));
        await d.getByRole("button", { name: "Open gift card" }).waitFor();
      },
    },
    {
      say: "Thẻ đã được tạo. Có thể in thẻ ngay tại đây. Bấm Open gift card để xem chi tiết.",
      async run(h) {
        const d = h.page.getByRole("dialog", { name: "Create a gift card" });
        await h.moveTo(d.getByRole("button", { name: "Print" }));
        await h.sleep(2600);
        await h.click(d.getByRole("button", { name: "Open gift card" }));
        await h.page.getByRole("heading", { level: 1 }).waitFor();
      },
    },
    {
      say: "Trang chi tiết cho thấy số dư, ngày hết hạn và khách hàng. Nút Use để trừ tiền khi khách dùng thẻ, Top up để nạp thêm tiền.",
      async run(h) {
        await h.sleep(500);
        // "Balance" is also a History column, so find the card by its own labels.
        await h.highlight(box(h.page, "Valid until", "Top up"));
        await h.sleep(4500);
        await h.moveTo(h.page.getByRole("button", { name: "Use", exact: true }));
        await h.sleep(1500);
        await h.moveTo(h.page.getByRole("button", { name: "Top up" }));
      },
    },
    {
      say: "Bên phải là lịch sử của thẻ. Mỗi lần tạo, dùng hay nạp tiền đều được ghi lại ở đây.",
      async run(h) {
        await h.highlight(box(h.page, "History", "Activity"));
      },
    },
    {
      say: "Bên dưới là thẻ in, có mã QR để khách tự xem số dư. Có thể in lại hoặc tải PDF bất cứ lúc nào.",
      async run(h) {
        await h.unhighlight();
        await h.scrollBy(400);
        await h.highlight(box(h.page, "Printed gift card", "Card size"));
        await h.sleep(3500);
        await h.unhighlight();
        await h.moveTo(h.page.getByRole("button", { name: "Download PDF" }));
      },
    },
    {
      say: "Vậy là xong. Video tiếp theo hướng dẫn in thẻ trống để bán sau.",
      async run(h) {
        await h.scrollBy(-800);
      },
    },
  ],
});
