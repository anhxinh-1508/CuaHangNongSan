const asyncHandler = require("../utils/asyncHandler");
const { Contact } = require("../models");
const { notifyNewContact } = require("../services/notification.service");
const { cleanText } = require("./helpers");

exports.createContact = asyncHandler(async (req, res) => {
  const payload = {
    name: cleanText(req.body.name),
    email: cleanText(req.body.email),
    subject: cleanText(req.body.subject),
    message: cleanText(req.body.message),
  };
  const contact = await Contact.create(payload);
  notifyNewContact(contact).catch(() => {});
  res.status(201).json({ message: "Contact created", data: contact });
});

exports.listContacts = asyncHandler(async (_req, res) => {
  const data = await Contact.find({}).sort({ createdAt: -1 });
  res.json({ data });
});

exports.updateContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { $set: { status: req.body.status, internalNotes: req.body.internalNotes || "" } },
    { new: true }
  );
  res.json({ data: contact });
});
