# AlphaQuant

> **AI-powered Stock Risk Analysis & Investment Learning Platform**

AlphaQuant là nền tảng hỗ trợ học tập và phân tích rủi ro chứng khoán bằng AI, được thiết kế dành cho học sinh, sinh viên và những người mới bắt đầu đầu tư. Thay vì đưa ra khuyến nghị mua hoặc bán, AlphaQuant tập trung giúp người dùng hiểu dữ liệu thị trường, nhận diện rủi ro và xây dựng tư duy đầu tư dựa trên dữ liệu.

---

# About AlphaQuant

## Ý nghĩa tên gọi

Tên **AlphaQuant** được hình thành từ hai khái niệm trong lĩnh vực tài chính:

- **Alpha** là thuật ngữ chỉ mức lợi nhuận vượt trội so với thị trường chung, đại diện cho mục tiêu giúp nhà đầu tư đưa ra quyết định tốt hơn dựa trên dữ liệu.
- **Quant** là viết tắt của *Quantitative Analysis* – phương pháp phân tích định lượng sử dụng dữ liệu, thống kê và mô hình toán học.

Tên gọi này phản ánh định hướng của dự án: ứng dụng AI và khoa học dữ liệu để biến những thông tin tài chính phức tạp thành kiến thức dễ hiểu dành cho người mới.

---

# Background

Đến cuối năm 2025, Việt Nam có hơn **11 triệu tài khoản chứng khoán cá nhân**, trong đó phần lớn là nhà đầu tư mới.

Mặc dù số lượng người tham gia thị trường ngày càng tăng, đa số các nền tảng phân tích hiện nay vẫn được thiết kế cho người đã có kiến thức tài chính. Điều này khiến nhiều người mới gặp khó khăn trong việc:

- Hiểu các chỉ số tài chính.
- Đánh giá mức độ rủi ro của cổ phiếu.
- Phân biệt thông tin đáng tin cậy với tin đồn trên mạng xã hội.
- Đưa ra quyết định đầu tư dựa trên dữ liệu thay vì cảm xúc.

AlphaQuant được xây dựng nhằm thu hẹp khoảng cách giữa dữ liệu tài chính và khả năng tiếp cận của người dùng phổ thông.

---

# Project Goal

AlphaQuant xây dựng hệ thống phân tích và trực quan hóa rủi ro chứng khoán dựa trên dữ liệu thị trường.

Mục tiêu của nền tảng là:

- Giúp người mới hiểu ý nghĩa của các chỉ số tài chính.
- Hỗ trợ học tập thông qua AI giải thích theo ngữ cảnh.
- Khuyến khích tư duy quản trị rủi ro trước khi đầu tư.
- Trình bày dữ liệu bằng ngôn ngữ đơn giản và trực quan.
- Không cung cấp khuyến nghị mua hoặc bán cổ phiếu.

---

# Target Users

AlphaQuant hướng tới:

- Học sinh
- Sinh viên
- Nhà đầu tư mới
- Người muốn học đầu tư từ dữ liệu thay vì tin đồn

---

# Core Features

## AI Risk Tutor

AI đóng vai trò như một người hướng dẫn học tập, giải thích các chỉ số tài chính bằng ngôn ngữ đơn giản thay vì chỉ hiển thị con số.

### Highlights

- Giải thích Beta, Sharpe Ratio, Volatility và Maximum Drawdown.
- Phân tích theo ngữ cảnh của từng cổ phiếu.
- Điều chỉnh nội dung theo trình độ người dùng.
- Không đưa ra khuyến nghị đầu tư.

---

## Time-Travel Backtesting

Cho phép người dùng quay lại các giai đoạn lịch sử của thị trường để thực hành phân tích và đưa ra quyết định như trong điều kiện thực tế.

### Highlights

- Phát lại dữ liệu lịch sử theo dòng thời gian.
- Mô phỏng quyết định Buy / Hold / Sell.
- AI phân tích quyết định sau mỗi phiên.
- Học từ các biến động đã từng xảy ra.

---

## Educational Red Flag Alert

Hệ thống phát hiện các tín hiệu rủi ro và giải thích nguyên nhân thay vì chỉ hiển thị cảnh báo.

### Highlights

- Phát hiện tín hiệu bất thường.
- Giải thích nguyên nhân.
- Liên kết kiến thức liên quan.
- Hướng dẫn người dùng tự đánh giá dữ liệu.

---

# Existing Product Features

## Stock Analysis

- Current Price
- Risk Level
- Volatility
- Beta
- Sharpe Ratio
- Maximum Drawdown

## Stock Comparison

- Multi-stock comparison
- Normalized price comparison
- Volatility comparison

## Data Visualization

- Candlestick Chart
- Volume Chart
- Rolling Volatility
- Historical Price Visualization

## Watchlist

- Add / Remove stocks
- Quick stock switching

## Learning

- Financial Glossary
- Community
- Guided Tour
- AI Analysis Demo

---

# AI Architecture

AlphaQuant sử dụng mô hình Large Language Model (LLM) để chuyển đổi dữ liệu tài chính thành nội dung mang tính giáo dục.

```
User
    │
Frontend (React)
    │
Backend API
    │
Market Data
    │
Context Builder
    │
Prompt Builder
    │
Gemini / OpenAI API
    │
Response Validation
    │
Frontend UI
```

Toàn bộ phản hồi của AI được kiểm tra và bổ sung các quy tắc an toàn nhằm đảm bảo nội dung chỉ mang tính giáo dục và không tạo ra khuyến nghị giao dịch.

---

# Technology Stack

## Frontend

- React
- HTML
- CSS
- JavaScript

## AI

- Gemini API / OpenAI API
- Prompt Engineering

## Visualization

- Interactive Charts
- Risk Dashboard

## Deployment

- GitHub Pages

---

# Product Value

AlphaQuant không hướng tới việc thay thế chuyên gia tài chính.

Thay vào đó, sản phẩm tập trung vào:

- Đơn giản hóa kiến thức đầu tư.
- Giải thích dữ liệu bằng AI.
- Phát triển tư duy quản trị rủi ro.
- Khuyến khích người dùng tự đưa ra quyết định dựa trên dữ liệu.

---

# Future Roadmap

- Personalized Learning Path
- Historical Scenario Library
- Explainable AI
- Adaptive Learning
- Multi-Asset Support
- Learning Progress Tracking

---

# Key Takeaways

- AI đóng vai trò là công cụ hỗ trợ học tập, không phải cố vấn đầu tư.
- Mọi phân tích đều hướng tới nâng cao hiểu biết và nhận thức về rủi ro.
- AlphaQuant kết hợp dữ liệu thị trường, trực quan hóa và AI để giúp người mới tiếp cận đầu tư một cách dễ hiểu hơn.

---

# Disclaimer

AlphaQuant là nền tảng phục vụ mục đích giáo dục và nghiên cứu. Mọi nội dung phân tích được tạo ra nhằm hỗ trợ người dùng hiểu dữ liệu tài chính và không được xem là khuyến nghị mua, bán hoặc nắm giữ bất kỳ loại chứng khoán nào.