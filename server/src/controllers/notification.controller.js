const asyncHandler = require("../utils/asyncHandler");
const { Notification } = require("../models");
const {
  checkAndNotifyBatchExpiry,
  checkAndNotifyCouponExpiry,
} = require("../services/notification.service");

exports.getNotifications = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const skip = (page - 1) * limit;
  const query = { userId: req.user._id };
  const [total, data, unreadCount] = await Promise.all([
    Notification.countDocuments(query),
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);
  res.json({ data, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isRead: true });
  res.json({ message: "Marked as read" });
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: "All marked as read" });
});

exports.triggerExpiryCheck = asyncHandler(async (_req, res) => {
  await Promise.all([checkAndNotifyBatchExpiry(), checkAndNotifyCouponExpiry()]);
  res.json({ message: "Expiry check completed" });
});
