import React, { useState } from "react";
import { DBState, api } from "../lib/api";
import { MaintenanceRequest, Announcement, Rule } from "../types";
import { 
  Wrench, Bell, Scroll, Clock, AlertTriangle, CheckCircle, 
  Trash2, Plus, Calendar, Shield, Tag, Sparkles, Filter, ExternalLink, Facebook
} from "lucide-react";

interface MaintenanceProps {
  db: DBState;
  onRefresh: () => void;
}

export default function Maintenance({ db, onRefresh }: MaintenanceProps) {
  const [activeSubTab, setActiveSubTab] = useState<"tickets" | "announcements" | "rules" | "facebook">("tickets");
  const [loading, setLoading] = useState(false);
  const [maintFilter, setMaintFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");

  // Form states
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  
  const [ruleText, setRuleText] = useState("");
  const [ruleCategory, setRuleCategory] = useState("General");

  // Sorted lists
  const tickets = db.maintenanceRequests || [];
  const announcements = [...(db.announcements || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const rules = db.rules || [];

  // Filtered maintenance requests
  const filteredTickets = tickets.filter(t => {
    if (maintFilter === "all") return true;
    return t.status === maintFilter;
  });

  const handleUpdateMaintStatus = async (id: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      setLoading(true);
      await api.updateMaintenanceRequest(id, { status: newStatus });
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to update ticket status.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    try {
      setLoading(true);
      await api.createAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim()
      });
      setAnnTitle("");
      setAnnContent("");
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to create announcement.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      setLoading(true);
      await api.deleteAnnouncement(id);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleText.trim()) return;

    try {
      setLoading(true);
      await api.createRule({
        rule_text: ruleText.trim(),
        category: ruleCategory
      });
      setRuleText("");
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to create rule.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      setLoading(true);
      await api.deleteRule(id);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: 'High' | 'Medium' | 'Low') => {
    switch (priority) {
      case "High":
        return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">🔴 High Urgency</span>;
      case "Medium":
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">🟡 Medium</span>;
      case "Low":
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">🟢 Low</span>;
    }
  };

  const getStatusBadge = (status: 'pending' | 'in_progress' | 'completed') => {
    switch (status) {
      case "pending":
        return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase">Pending</span>;
      case "in_progress":
        return <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase animate-pulse">In Progress</span>;
      case "completed":
        return <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase">Completed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-brand-orange" />
            Service & Communication Center
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Manage live maintenance requests submitted by the AI assistant and update general complex rules or announcements.
          </p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl gap-1 border border-slate-700/50">
          <button
            onClick={() => setActiveSubTab("tickets")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "tickets" ? "bg-brand-orange text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveSubTab("announcements")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "announcements" ? "bg-brand-orange text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Announcements ({announcements.length})
          </button>
          <button
            onClick={() => setActiveSubTab("rules")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "rules" ? "bg-brand-orange text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveSubTab("facebook")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "facebook" ? "bg-brand-orange text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            <Facebook className="w-3.5 h-3.5" />
            FB Messenger Bot
          </button>
        </div>
      </div>

      {/* Main tab sections */}
      {activeSubTab === "tickets" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Status:</span>
            </div>
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
              {(["all", "pending", "in_progress", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setMaintFilter(filter)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-all ${
                    maintFilter === filter 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Tickets List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTickets.length === 0 ? (
              <div className="col-span-full bg-white text-center py-16 border border-slate-100 rounded-2xl shadow-sm text-slate-400 text-xs">
                <Wrench className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                No maintenance requests logged for this filter.
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div key={ticket.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col justify-between gap-4">
                  <div>
                    {/* Upper Metadata */}
                    <div className="flex justify-between items-start gap-2 border-b border-slate-50 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">Room {ticket.room_number || "Guest"}</span>
                          {getPriorityBadge(ticket.priority)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          ID: {ticket.id} • {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 leading-relaxed font-light">
                        {ticket.issue_description}
                      </p>

                      {/* Photo Thumbnail if attached */}
                      {ticket.photo_url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-slate-100 max-h-40 relative group">
                          <img src={ticket.photo_url} alt="Problem issue proof" className="w-full h-full object-cover max-h-40" referrerPolicy="no-referrer" />
                          <a 
                            href={ticket.photo_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 bg-slate-950/80 hover:bg-slate-950 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open Full Image
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500 font-semibold truncate max-w-[140px]">
                      👤 {ticket.tenant_name || "Guest Visitor"}
                    </span>

                    {ticket.status !== "completed" && (
                      <div className="flex gap-1.5">
                        {ticket.status === "pending" && (
                          <button
                            onClick={() => handleUpdateMaintStatus(ticket.id, "in_progress")}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors"
                          >
                            Assign to Work
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateMaintStatus(ticket.id, "completed")}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors"
                        >
                          Mark Completed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Announcement Form */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-3">
              <Plus className="w-4 h-4 text-brand-orange" />
              Publish Announcement
            </h3>
            <form onSubmit={handleAddAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g., Elevator scheduled shutdown"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-brand-orange text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Content Details</label>
                <textarea
                  rows={4}
                  placeholder="Provide precise dates, times, and scope of operations..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-brand-orange text-xs text-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !annTitle || !annContent}
                className="w-full bg-slate-950 hover:bg-slate-800 text-white p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                Broadcast Announcement
              </button>
            </form>
          </div>

          {/* Announcements Feed */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 mb-3">
              Broadcast Archives
            </h3>
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {announcements.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-light">
                  No published announcements found in database.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2 relative">
                    <div className="flex justify-between items-start gap-4 pr-6">
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{ann.title}</h4>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="absolute right-3 top-3 p-1 bg-white border border-slate-100 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-slate-600 font-light leading-relaxed whitespace-pre-line">{ann.content}</p>
                    <span className="block text-[9px] text-slate-400 font-mono">
                      📅 Published on {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "rules" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Rule Form */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-3">
              <Plus className="w-4 h-4 text-brand-orange" />
              Add Complex Policy
            </h3>
            <form onSubmit={handleAddRule} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-brand-orange text-xs text-slate-800"
                >
                  <option value="General">General Behavior</option>
                  <option value="Noise">Noise & Quiet Hours</option>
                  <option value="Guests">Guests & Visitors</option>
                  <option value="Pets">Pets & Animal Registry</option>
                  <option value="Hygiene">Hygiene & Waste Disposal</option>
                  <option value="Modifications">Drilling & Remodeling</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rule Policy Text</label>
                <textarea
                  rows={4}
                  placeholder="e.g., Quiet hours are strictly observed from 10:00 PM to 6:00 AM..."
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-brand-orange text-xs text-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !ruleText}
                className="w-full bg-slate-950 hover:bg-slate-800 text-white p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Scroll className="w-3.5 h-3.5" />
                Commit Policy Rule
              </button>
            </form>
          </div>

          {/* Rules Ledger List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 mb-3">
              Active Policy Register
            </h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {rules.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-light">
                  No complex policy rules found in database.
                </div>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-start gap-4 relative">
                    <div className="space-y-1.5 pr-6">
                      <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[9px] uppercase font-mono">
                        {rule.category || "General"}
                      </span>
                      <p className="text-slate-700 leading-relaxed font-light">{rule.rule_text}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="absolute right-3 top-3 p-1 bg-white border border-slate-100 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "facebook" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          {/* Header Block */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full mb-2">
                <Facebook className="w-3.5 h-3.5" />
                Live Meta Integration
              </span>
              <h2 className="text-lg font-bold text-slate-900">Facebook Messenger Bot Configuration</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect your live Facebook App to enable users, tenants, and visitors to message your property page and interact with the AI Assistant.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Webhook Ready
              </span>
            </div>
          </div>

          {/* Interactive Webhook Properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Webhook Callback URL</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/webhook/facebook`}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 w-full font-mono outline-none"
                  id="fb-callback-url-input"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/facebook`);
                    alert("Callback URL copied to clipboard!");
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all"
                >
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Input this URL inside your Facebook Developer App Console under Messenger API - Webhooks.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Verify Token (hub.verify_token)</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value="abc_apartment_verify_token"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 w-full font-mono outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("abc_apartment_verify_token");
                    alert("Verify Token copied to clipboard!");
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all"
                >
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                A custom validation string used by Facebook to verify your ownership of the server.
              </p>
            </div>
          </div>

          {/* Setup Guide Step-by-Step */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-orange" />
              Easy Connection Checklist (4 Steps)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border border-slate-100 rounded-xl space-y-2 hover:border-slate-200 transition-all">
                <div className="w-7 h-7 bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center justify-center text-xs">
                  1
                </div>
                <h4 className="font-bold text-xs text-slate-900">Create Meta App</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                  Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Meta Developers Portal</a>, create a new App, and choose <strong>Other</strong> &rarr; <strong>Business / Messenger</strong>.
                </p>
              </div>

              <div className="p-4 border border-slate-100 rounded-xl space-y-2 hover:border-slate-200 transition-all">
                <div className="w-7 h-7 bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center justify-center text-xs">
                  2
                </div>
                <h4 className="font-bold text-xs text-slate-900">Configure Webhook</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                  Add the <strong>Messenger</strong> product. Under Webhook Settings, click Configure. Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from above.
                </p>
              </div>

              <div className="p-4 border border-slate-100 rounded-xl space-y-2 hover:border-slate-200 transition-all">
                <div className="w-7 h-7 bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center justify-center text-xs">
                  3
                </div>
                <h4 className="font-bold text-xs text-slate-900">Subscribe Events</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                  Under subscription fields, check <strong>messages</strong> and <strong>messaging_postbacks</strong>. This forwards message events to this AI.
                </p>
              </div>

              <div className="p-4 border border-slate-100 rounded-xl space-y-2 hover:border-slate-200 transition-all">
                <div className="w-7 h-7 bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center justify-center text-xs">
                  4
                </div>
                <h4 className="font-bold text-xs text-slate-900">Add Access Token</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                  Generate a <strong>Page Access Token</strong> for your FB Page. In AI Studio's Settings panel, add it as <code>FACEBOOK_PAGE_ACCESS_TOKEN</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Features highlight & self-healing link system */}
          <div className="p-4 bg-amber-50/50 border border-amber-100/50 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Special Tenant Profile Verification Feature
            </h4>
            <p className="text-[11px] text-amber-700 leading-relaxed font-light">
              This Messenger bot is equipped with a self-healing account verification system!
              By default, users chat as Guests. However, if a user types <code>link &lt;contact_number&gt;</code> (for example: <code>link 09171234567</code>), the system automatically looks up their tenant file in your lease directory. If found, it links their Facebook ID.
              They can then instantly view rent balances, see next due deadlines, and file maintenance tickets connected directly to their room!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
