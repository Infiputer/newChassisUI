# ChassisUI - Multi-Model Chat Interface

ChassisUI is a modern, multi-model chat interface that allows users to have conversations with different AI models. It features conversation branching, real-time streaming, and advanced analytics for model discovery.

## Features

### Core Functionality
- **Multi-Model Support**: Choose from different AI models for each conversation
- **Conversation Branching**: Edit any message to create new conversation paths
- **Real-Time Streaming**: Live AI responses with token-by-token streaming
- **Background Processing**: Conversations continue even if you disconnect
- **Model Discovery**: Trending, recently used, and recommended models

### Advanced Features
- **User Authentication**: Secure JWT-based authentication with refresh tokens
- **Conversation Management**: Create, edit, and delete conversations
- **Message Editing**: Edit any message to explore different conversation paths
- **Analytics**: Track model usage and get personalized recommendations
- **Responsive Design**: Modern, clean interface that works on all devices

## Architecture

### Backend (Node.js/Express)
- **Database**: PostgreSQL with tree-structured message storage
- **Authentication**: JWT with refresh token mechanism
- **Real-time**: WebSocket for streaming responses
- **Security**: Rate limiting, CORS, and input validation

### Frontend (React/TypeScript)
- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS for modern design
- **State Management**: React Context for authentication
- **Routing**: React Router for navigation

### Database Schema
- **Tree Structure**: Messages stored with parent-child relationships
- **Analytics**: Comprehensive usage tracking
- **User Management**: Secure user authentication and profiles

## Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd chassisui
```

### 2. Install Dependencies
```bash
# Install all dependencies (root, server, and client)
npm run install-all
```

### 3. Database Setup

#### Create PostgreSQL Database
```sql
CREATE DATABASE chassisui;
CREATE USER chassisui_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE chassisui TO chassisui_user;
```

#### Configure Environment Variables
Copy the environment template and configure your settings:

```bash
cd server
cp env.example .env
```

Edit `.env` with your database and JWT settings:
```env
# Database Configuration
DATABASE_URL=postgresql://chassisui_user:your_password@localhost:5432/chassisui

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Run Database Setup
```bash
npm run setup-db
```

### 4. Start the Application

#### Development Mode
```bash
# Start both server and client
npm run dev
```

#### Production Mode
```bash
# Build the client
npm run build

# Start the server
cd server
npm start
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Usage

### 1. Create an Account
- Visit http://localhost:3000/register
- Enter your name, email, and password
- You'll be automatically logged in

### 2. Start a New Chat
- Click "New Chat" in the sidebar
- Choose from available AI models
- Start typing your message

### 3. Explore Conversation Branching
- Click the "Edit" button on any user message
- Modify your question or statement
- See how the AI responds differently

### 4. Discover Models
- Switch to the "Models" tab in the sidebar
- Browse trending, recent, and recommended models
- Try different models for different types of conversations

## Configuration

### Adding New Models
To add new AI models, insert records into the database:

```sql
INSERT INTO models (name, description, short_description, long_description)
VALUES ('Your Model', 'Description', 'Short desc', 'Long description');

INSERT INTO model_endpoints (model_id, url, is_active, weight)
VALUES ('model-uuid', 'https://your-model-api.com', true, 1);
```

### Customizing the Interface
- Edit `client/src/index.css` for global styles
- Modify Tailwind config in `client/tailwind.config.js`
- Update components in `client/src/components/`

## Deployment

### Environment Variables
Set production environment variables:
- `NODE_ENV=production`
- `DATABASE_URL` (production database)
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (strong secrets)
- `CORS_ORIGIN` (your domain)

### Build for Production
```bash
# Build the client
npm run build

# The built files will be in client/build/
```

### Server Deployment
- Deploy the `server/` directory
- Ensure PostgreSQL is accessible
- Set up reverse proxy (nginx) if needed
- Configure SSL certificates

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: Prevent abuse with request limits
- **CORS Protection**: Configured for security
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env
   - Ensure database and user exist

2. **JWT Errors**
   - Verify JWT_SECRET and JWT_REFRESH_SECRET are set
   - Check token expiration settings

3. **WebSocket Connection Issues**
   - Ensure server is running on port 3001
   - Check CORS configuration
   - Verify authentication token

4. **Build Errors**
   - Clear node_modules and reinstall
   - Check Node.js version (16+ required)
   - Verify all dependencies are installed

### Logs
- Server logs: Check console output
- Client logs: Browser developer tools
- Database logs: PostgreSQL logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the code comments for implementation details

## Future Enhancements

- **File Upload Support**: Upload and analyze documents
- **Voice Input**: Speech-to-text integration
- **Export Conversations**: PDF, Markdown export
- **Collaborative Chats**: Share conversations with others
- **Advanced Analytics**: Detailed usage insights
- **Model Fine-tuning**: Custom model training interface

## Recovery Notes

Local secrets belong in `.env`. Use `.env.example` as the template; `TEST_USER_PASSWORD`
is required for the test-user helper.

Generated React build output and Python caches were intentionally omitted.
