# TỦ THUỐC GIA ĐÌNH

## Mục tiêu

Trang web tĩnh được host bằng GitHub Pages. Danh sách thuốc có bản lưu trên trình duyệt hiện tại và được đồng bộ qua Google Sheets khi cấu hình Apps Script Web App.

## Thiết lập đồng bộ Google Sheets

### 1. Tạo bảng tính

1. Đăng nhập tài khoản Google sẽ sở hữu dữ liệu và tạo một Google Sheet mới.
2. Sao chép ID trong URL. Ví dụ URL `https://docs.google.com/spreadsheets/d/ABC123/edit` thì ID là `ABC123`.
3. Giữ Sheet ở chế độ riêng tư; không cần chia sẻ Sheet công khai cho người dùng app.

### 2. Tạo Apps Script

1. Trong Sheet, chọn **Extensions > Apps Script**.
2. Thay nội dung `Code.gs` bằng toàn bộ mã trong file `apps_script.gs` của dự án.
3. Thay `DAN_ID_GOOGLE_SHEET_VAO_DAY` bằng ID đã sao chép, giữ nguyên dấu ngoặc kép.
4. Bấm **Save**.

### 3. Triển khai Web App

1. Bấm **Deploy > New deployment**.
2. Bấm biểu tượng bánh răng cạnh **Select type**, chọn **Web app**.
3. Chọn **Execute as: Me** (tài khoản đang sở hữu Sheet).
4. Chọn **Who has access: Anyone** hoặc tùy chọn cho phép người dùng app truy cập ẩn danh.
5. Bấm **Deploy**, chấp thuận quyền truy cập Sheet khi Google hỏi.
6. Sao chép URL Web App kết thúc bằng `/exec`. Không dùng URL thử nghiệm `/dev`.

### 4. Cấu hình trang web

1. Mở `index.html`.
2. Tìm `const API_URL="";` và dán URL `/exec` vào dấu ngoặc kép, ví dụ `const API_URL="https://script.google.com/macros/s/....../exec";`.
3. Lưu và tải `index.html` đã cập nhật lên repository GitHub, ghi đè bản cũ.
4. Đợi GitHub Pages deploy xong, mở lại trang. Nếu trang cũ vẫn hiện, làm mới mạnh (Ctrl+F5) hoặc xóa cache.

## Đồng bộ hoạt động thế nào

- Khi mở trang, app tải danh sách từ Google Sheets.
- Nếu Sheet chưa có thuốc nhưng trình duyệt này đã có dữ liệu cũ, app đưa dữ liệu cũ lên Sheet lần đầu.
- Nếu Sheet đã có dữ liệu, dữ liệu Sheet được dùng và lưu lại vào trình duyệt.
- Khi thêm, sửa, tăng/giảm số lượng hoặc xóa thuốc, app gửi toàn bộ danh sách lên Sheet.
- Nút **Đồng bộ** tải lại dữ liệu từ Sheet khi mở trang; sau khi tải xong, nếu Sheet rỗng và trình duyệt có dữ liệu thì app khởi tạo Sheet từ dữ liệu đó.
- Thiết bị khác chỉ cần mở cùng URL GitHub Pages để lấy cùng dữ liệu. Kết nối internet cần thiết để đọc/ghi Sheet.

## Lưu ý quan trọng

- Hãy sao lưu danh sách thuốc cũ trước khi cấu hình. Nếu Sheet đã có dữ liệu, Sheet sẽ ghi đè dữ liệu riêng trên thiết bị mới.
- Mỗi lần cập nhật ghi đè toàn bộ danh sách. Tránh sửa danh sách đồng thời trên nhiều thiết bị; lần ghi sau có thể ghi đè thay đổi vừa thực hiện trên thiết bị kia.
- Quyền `Anyone` làm URL Apps Script có thể được gọi bởi người biết URL. Không lưu dữ liệu nhạy cảm hoặc thông tin định danh cá nhân trong bảng.
- Google Sheets/Apps Script dùng hạn mức theo tài khoản Google; phù hợp ứng dụng gia đình với tần suất thấp, không phải hệ thống nhiều người dùng.
- Apps Script tạo tab `THUOC` tự động. Bản hiện tại không sử dụng tab `LICH_SU`.

## Tính năng hiện có

- Thêm/sửa/xóa thuốc, thay đổi số lượng, HSD, mức tồn tối thiểu.
- Tìm kiếm và cảnh báo.
- Lưu local trên trình duyệt và đồng bộ một danh sách qua Google Sheets.
- PWA manifest.

Lưu ý y tế: ứng dụng chỉ quản lý tủ thuốc. Không dùng dữ liệu trong app để tự chẩn đoán hoặc thay thế hướng dẫn của bác sĩ/dược sĩ.
