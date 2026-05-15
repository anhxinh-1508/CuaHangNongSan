const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { ChatSession, ChatMessage } = require("../models");
const { suggestProducts } = require("../services/chatbot.service");

exports.createChatSession = asyncHandler(async (req, res) => {
  const session = await ChatSession.create({
    userId: req.user?._id || null,
    guestId: req.body.guestId || Math.random().toString(36).slice(2, 10),
  });
  res.status(201).json({ data: session });
});

exports.chatMessage = asyncHandler(async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message)
    throw new AppError("VALIDATION_ERROR", "Thiếu sessionId hoặc nội dung tin nhắn", 422);
  const session = await ChatSession.findById(sessionId);
  if (!session) throw new AppError("NOT_FOUND", "Không tìm thấy phiên chat", 404);
  await ChatMessage.create({ sessionId, role: "user", content: message });
  const historyRows = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).limit(32).lean();
  const conversationMessages = historyRows.map((row) => ({
    role: row.role,
    content: String(row.content || "").slice(0, 6000),
  }));
  const structured = await suggestProducts(message, Number(req.body.maxRecommendations || 5), conversationMessages);
  const aiMsg = await ChatMessage.create({
    sessionId,
    role: "assistant",
    content: structured.answer,
    structured,
  });
  res.json({ data: { messageId: aiMsg._id, ...structured } });
});

exports.chatHistory = asyncHandler(async (req, res) => {
  const data = await ChatMessage.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
  res.json({ data });
});

exports.chatFeedback = asyncHandler(async (req, res) => {
  res.json({ message: "Feedback received", data: req.body });
});
