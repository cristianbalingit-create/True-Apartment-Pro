import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Image, Sparkles, User, AlertCircle, RefreshCw, ChevronDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, DBState } from "../lib/api";
import { Tenant, MaintenanceRequest } from "../types";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  suggestedReplies?: string[];
  photoUrl?: string;
  isTicket?: boolean;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [db, setDb] = useState<DBState | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  
  // Maintenance Report wizard state (optional wizard inside the chat flow)
  const [maintenanceWizard, setMaintenanceWizard] = useState<{
    step: "idle" | "awaiting_description" | "awaiting_photo";
    description?: string;
    photoBase64?: string;
    photoName?: string;
  }>({ step: "idle" });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load database state for tenants on mount
  const loadData = async () => {
    try {
      const state = await api.getDB();
      setDb(state);
    } catch (error) {
      console.error("Failed to load DB state in chatbot:", error);
    }
  };

  useEffect(() => {
    loadData();
    // Load welcoming message
    setMessages([
      {
        id: "msg-welcome",
        sender: "bot",
        text: "👋 Welcome to **ABC Apartment Assistant**!\n\nHow can I help you today? Feel free to ask me anything or select one of the quick actions below to manage your apartment lease.",
        timestamp: new Date(),
        suggestedReplies: [
          "📋 Transaction History",
          "💳 Send Payment",
          "💰 Balance / Deposit / Advance",
          "🔧 Report Maintenance",
          "📢 View Announcements",
          "📜 Apartment Rules"
        ]
      }
    ]);
  }, []);

  // Scroll to bottom whenever messages change or chatbot opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text && !maintenanceWizard.photoBase64) return;

    // Reset input
    setInputMessage("");

    // Create user message
    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: text || "Submitted a photo attachment",
      timestamp: new Date(),
      photoUrl: maintenanceWizard.photoBase64 ? `data:image/png;base64,${maintenanceWizard.photoBase64}` : undefined
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // If the maintenance wizard is active, handle it locally
    if (maintenanceWizard.step === "awaiting_description") {
      setMaintenanceWizard({
        step: "awaiting_photo",
        description: text
      });
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-maint-${Date.now()}`,
          sender: "bot",
          text: "Great! Would you like to upload a photo of the issue? Click the **📎 Image** icon below to attach a photo, or type **'No'** to skip and submit your ticket.",
          timestamp: new Date(),
          suggestedReplies: ["No photo, submit ticket"]
        }
      ]);
      return;
    }

    if (maintenanceWizard.step === "awaiting_photo") {
      let finalPhotoUrl = "";
      
      // If we have an attached photo, upload it to the server first
      if (maintenanceWizard.photoBase64 && maintenanceWizard.photoName) {
        try {
          const uploadRes = await api.uploadFile(maintenanceWizard.photoName, maintenanceWizard.photoBase64);
          finalPhotoUrl = uploadRes.url;
        } catch (e) {
          console.error("Failed to upload photo:", e);
        }
      }

      const isSkipped = text.toLowerCase().includes("no") || text.toLowerCase().includes("skip");
      const issueDescription = maintenanceWizard.description || "Unspecified maintenance request";

      try {
        // Find tenant details
        const tenant = db?.tenants.find((t) => t.id === selectedTenantId);
        const room = db?.rooms.find((r) => r.id === tenant?.room_id);

        // Map category locally
        let category: any = "Other";
        let priority: "High" | "Medium" | "Low" = "Medium";
        const descLower = issueDescription.toLowerCase();

        if (descLower.includes("leak") || descLower.includes("water") || descLower.includes("plumbing") || descLower.includes("faucet") || descLower.includes("clogged")) {
          category = "Plumbing";
          if (descLower.includes("no water") || descLower.includes("burst") || descLower.includes("flooding")) priority = "High";
        } else if (descLower.includes("electricity") || descLower.includes("light") || descLower.includes("wire") || descLower.includes("spark") || descLower.includes("power") || descLower.includes("short")) {
          category = "Electrical";
          if (descLower.includes("no power") || descLower.includes("spark") || descLower.includes("burning")) priority = "High";
        } else if (descLower.includes("internet") || descLower.includes("wifi") || descLower.includes("router") || descLower.includes("connection")) {
          category = "Internet";
          priority = "Low";
        } else if (descLower.includes("aircon") || descLower.includes("air conditioning") || descLower.includes("cooling") || descLower.includes("ac")) {
          category = "Air Conditioning";
          priority = "Medium";
        }

        const res = await api.createMaintenanceRequest({
          room_id: tenant?.room_id || "",
          room_number: room?.room_number || "Guest Room/Unknown",
          tenant_id: selectedTenantId || "guest",
          tenant_name: tenant?.name || "Guest Visitor",
          issue_description: issueDescription,
          category,
          priority,
          photo_url: finalPhotoUrl || undefined
        });

        const priorityEmoji = priority === "High" ? "🔴" : priority === "Medium" ? "🟡" : "🟢";
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: `🔧 **Maintenance Ticket Created Successfully!**\n\nI have automatically filed a ticket in our records:\n- **Ticket ID:** \`${res.id}\`\n- **Category:** ${category}\n- **Priority:** ${priorityEmoji} ${priority}\n- **Status:** ⏳ Pending Review\n\nOur property administration team has been notified immediately.`,
            timestamp: new Date(),
            isTicket: true,
            suggestedReplies: ["💰 Check Rent Balance", "📜 Apartment Rules", "📢 View Announcements"]
          }
        ]);
      } catch (error) {
        console.error("Failed to submit maintenance request:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            sender: "bot",
            text: "Sorry, I had trouble creating the ticket. Please try again or contact management directly.",
            timestamp: new Date()
          }
        ]);
      }

      // Reset Wizard state
      setMaintenanceWizard({ step: "idle" });
      setIsLoading(false);
      return;
    }

    // Standard conversational chatbot flow
    try {
      // Map message history to simple format
      const historyToSend = messages.slice(-10).map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await api.queryChatbot(text, selectedTenantId || undefined, historyToSend);
      
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: res.reply,
          timestamp: new Date(),
          suggestedReplies: res.suggested_replies || []
        }
      ]);
    } catch (error) {
      console.error("Chatbot query error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: "bot",
          text: "I am having trouble connecting to the apartment server right now. Let me know if you want to try again!",
          timestamp: new Date(),
          suggestedReplies: ["💰 Check Rent Balance", "📜 Apartment Rules"]
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    // If user clicked "🔧 Report Maintenance" or "Report Leak"
    if (action.includes("Report Maintenance") || action.includes("🔧 Report")) {
      setMaintenanceWizard({ step: "awaiting_description" });
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-act-${Date.now()}`,
          sender: "user",
          text: action,
          timestamp: new Date()
        },
        {
          id: `bot-maint-init-${Date.now()}`,
          sender: "bot",
          text: "🔧 **Maintenance Assistance**\n\nI can help you file a maintenance request directly into our property database. \n\n**What is the problem?** Please describe the issue in detail (e.g. 'My kitchen faucet is leaking' or 'The bedroom AC won't turn on').",
          timestamp: new Date()
        }
      ]);
      return;
    }

    if (action.includes("No photo") || action.includes("Skip")) {
      handleSendMessage("No photo, submit ticket");
      return;
    }

    // Default: send action as standard message
    handleSendMessage(action);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const strippedBase64 = base64.split(",")[1];
      setMaintenanceWizard((prev) => ({
        ...prev,
        photoBase64: strippedBase64,
        photoName: file.name
      }));

      // Confirm attachment in chat
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-attach-${Date.now()}`,
          sender: "bot",
          text: `📎 **Photo attached:** \`${file.name}\` successfully buffered! Ready to submit.`,
          timestamp: new Date(),
          suggestedReplies: ["Submit Ticket Now"]
        }
      ]);
    };
    reader.readAsDataURL(file);
  };

  const activeTenant = db?.tenants.find((t) => t.id === selectedTenantId);
  const activeRoom = db?.rooms.find((r) => r.id === activeTenant?.room_id);

  return (
    <div id="apartment-chatbot-root" className="fixed bottom-6 right-6 z-50 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col w-[360px] sm:w-[400px] h-[580px] overflow-hidden mb-4 relative"
            id="chatbot-container"
          >
            {/* Header */}
            <div className="bg-[#23140e] text-white p-4 flex flex-col gap-2 relative border-b border-[#e73f1e]/30">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#e73f1e] to-[#fb6c00] text-white rounded-full flex items-center justify-center font-bold relative border border-[#ffdd9c]/30">
                      <Sparkles className="w-4 h-4 text-[#ffdd9c]" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#f9b637] rounded-full border-2 border-[#23140e]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">ABC Assistant</h2>
                    <span className="text-[10px] text-[#ffdd9c] font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#fb6c00] rounded-full inline-block animate-pulse" />
                      ONLINE • HYBRID INTELLIGENCE
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { loadData(); }} 
                    className="p-1.5 hover:bg-[#331f16] rounded-lg text-[#ecd9c6] hover:text-white transition-colors"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-[#331f16] rounded-lg text-[#ecd9c6] hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Tenant Switcher Profile Selector */}
              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs relative">
                <span className="text-slate-400">Current User:</span>
                <button
                  onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium border border-slate-700/50 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="max-w-[120px] truncate">
                    {activeTenant ? `${activeTenant.name} (Rm ${activeRoom?.room_number})` : "Guest Visitor"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isTenantMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1 text-slate-200 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-900">
                      Select Tenant Profile
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTenantId("");
                        setIsTenantMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${!selectedTenantId ? "text-brand-orange font-semibold" : ""}`}
                    >
                      <span>👤 Guest / Prospective Tenant</span>
                    </button>
                    {db?.tenants.map((tenant) => {
                      const rm = db?.rooms.find((r) => r.id === tenant.room_id);
                      return (
                        <button
                          key={tenant.id}
                          onClick={() => {
                            setSelectedTenantId(tenant.id);
                            setIsTenantMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${selectedTenantId === tenant.id ? "text-brand-orange font-semibold bg-slate-700/30" : ""}`}
                        >
                          <span className="truncate">{tenant.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Rm {rm?.room_number}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Scroll Bar */}
            <div className="bg-slate-50 border-b border-slate-100 py-2.5 px-3 overflow-x-auto flex gap-2 scrollbar-none">
              <button
                onClick={() => handleQuickAction("💰 Check Rent Balance")}
                className="flex-shrink-0 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                💰 Balance
              </button>
              <button
                onClick={() => handleQuickAction("📅 View Due Date")}
                className="flex-shrink-0 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                📅 Due Date
              </button>
              <button
                onClick={() => handleQuickAction("🔧 Report Maintenance")}
                className="flex-shrink-0 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                🔧 Maintenance
              </button>
              <button
                onClick={() => handleQuickAction("📢 View Announcements")}
                className="flex-shrink-0 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                📢 News
              </button>
              <button
                onClick={() => handleQuickAction("📜 Apartment Rules")}
                className="flex-shrink-0 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                📜 Rules
              </button>
              <button
                onClick={() => handleQuickAction("👤 My Profile")}
                className="flex-shrink-0 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                👤 Profile
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${msg.sender === "user" ? "order-1" : "order-2"}`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-brand-orange text-white rounded-tr-none"
                          : msg.isTicket
                          ? "bg-emerald-50 border border-emerald-100 text-slate-800 rounded-tl-none font-medium"
                          : "bg-white text-slate-800 border border-slate-100 rounded-tl-none font-normal"
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">
                        {msg.text}
                      </p>

                      {msg.photoUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200/50">
                          <img src={msg.photoUrl} alt="Attached issue" className="w-full max-h-48 object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className={`block text-[9px] text-slate-400 mt-1 font-mono ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {/* Suggested Replies / Quick Actions inside bubbles */}
                    {msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 justify-start">
                        {msg.suggestedReplies.map((reply, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(reply)}
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                  maintenanceWizard.photoBase64
                    ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                title={maintenanceWizard.photoBase64 ? "Change attached photo" : "Attach a photo (Maintenance reports only)"}
              >
                {maintenanceWizard.photoBase64 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder={
                    maintenanceWizard.step === "awaiting_description"
                      ? "Describe your physical issue..."
                      : maintenanceWizard.step === "awaiting_photo"
                      ? "Type 'no' to submit or attach photo..."
                      : "Type a message or ask Gemini..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-orange text-slate-800 pr-8"
                />
              </div>

              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading}
                className="p-2 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:brightness-110 disabled:opacity-50 text-white rounded-xl transition-all flex items-center justify-center shadow-md shadow-[#fb6c00]/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher Bubble */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:brightness-110 focus:outline-none select-none relative border border-[#ffdd9c]/40"
        title="Open Apartment Assistant Chatbot"
        id="chatbot-launcher"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <MessageSquare className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#e73f1e] rounded-full border-2 border-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
