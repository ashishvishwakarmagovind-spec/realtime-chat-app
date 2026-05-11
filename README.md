# Real-Time Chat Platform (MERN Stack)

A professional, production-grade real-time chat application built using the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO. This platform supports private messaging, group chats, rich media sharing, and real-time interactive features with a premium UI.

## 🚀 Key Features

- **Real-Time Messaging**: Instant message delivery using Socket.IO with optimistic UI updates.
- **Group Chats**: Create multi-user groups, name them, and manage members.
- **Private Messaging**: Start chats instantly by searching for users by phone number or name.
- **Rich Media Support**: 
    - 📷 Photo Sharing
    - 📎 File Attachments
    - 🎤 Voice Notes (with interactive audio player)
- **Interactive UX**:
    - ✍️ Typing Indicators
    - 🟢 Online/Offline Presence Status
    - 🌗 Dark & Light Mode Support
    - 💬 Reply to specific messages
    - ✏️ Edit & Delete (Soft Delete) messages
- **Secure Authentication**: JWT-based authentication for secure access.
- **Aesthetic Design**: Modern, responsive UI built with Tailwind CSS and Vanilla CSS for a premium feel.

## 🛠️ Technology Stack

- **Frontend**: React.js, Tailwind CSS, Lucide React (Icons), Axios, Socket.io-client.
- **Backend**: Node.js, Express.js, Socket.io.
- **Database**: MongoDB Atlas (Mongoose).
- **Security**: JSON Web Tokens (JWT), Bcrypt password hashing.
- **File Handling**: Multer for local storage (configurable for S3/Cloudinary).

## 📦 Installation & Setup

### Prerequisites
- Node.js installed
- MongoDB Atlas account (or local MongoDB)

### 1. Clone the repository
```bash
git clone https://github.com/ashishvishwakarmagovind-spec/realtime-chat-app.git
cd realtime-chat-app
```

### 2. Backend Setup
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory:
```env
MONGO_URI=your_mongodb_atlas_uri
PORT=5001
JWT_SECRET=your_secret_key
CLIENT_ORIGIN=http://localhost:5173
```
Run the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
```
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5001
VITE_SOCKET_URL=http://localhost:5001
```
Run the client:
```bash
npm run dev
```

## 📸 Screenshots & Demo
The application features a clean, intuitive layout with a sidebar for conversations and a main chat area with rich interactive controls.
<img width="183" height="183" alt="image" src="https://github.com/user-attachments/assets/47786d94-b2db-43c0-9b8c-2afcc778cafa" /> <img width="183" height="183" alt="image" src="https://github.com/user-attachments/assets/2873b9d0-d911-45c6-b1fd-9fd039362a38" />
<img width="251" height="182" alt="image" src="https://github.com/user-attachments/assets/4336f479-e1c0-4c27-b613-3c5196fa9698" /> <img width="277" height="181" alt="image" src="https://github.com/user-attachments/assets/d245a90b-ae35-4b98-8cd0-711ff94cf980" />
<img width="278" height="182" alt="image" src="https://github.com/user-attachments/assets/9e6757ac-7a18-48b0-b1ff-5b4524c7f6e4" />

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests to improve the platform.

## 📜 License
This project is licensed under the MIT License.
