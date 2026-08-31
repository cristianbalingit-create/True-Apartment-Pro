import React, { useState } from "react";
import { DBState, api } from "../lib/api";
import { Apartment, Room } from "../types";
import { Building, Plus, Home, Edit3, Trash2, Eye, QrCode, Sparkles, X, Check, MapPin, Layers, DollarSign, Image, Download, Star, Info, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ApartmentsProps {
  db: DBState;
  onRefresh: () => void;
}

const ROOM_FALLBACK_IMAGES = {
  studio: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80",
  "1BR": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
  "2BR": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
  "3BR": "https://images.unsplash.com/photo-1585418694458-dc8085ab369d?auto=format&fit=crop&w=800&q=80",
};

export default function Apartments({ db, onRefresh }: ApartmentsProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAptId, setSelectedAptId] = useState<string>(db.apartments[0]?.id || "");

  // Dialog states
  const [showAptDialog, setShowAptDialog] = useState(false);
  const [editingApt, setEditingApt] = useState<Apartment | null>(null); // null = Add Mode
  
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null); // null = Add Mode

  const [qrRoom, setQrRoom] = useState<Room | null>(null);

  // Apartment form states
  const [aptName, setAptName] = useState("");
  const [aptAddress, setAptAddress] = useState("");
  const [aptTotalFloors, setAptTotalFloors] = useState(1);
  const [aptDescription, setAptDescription] = useState("");
  const [aptStatus, setAptStatus] = useState<"active" | "inactive">("active");
  const [aptNumRooms, setAptNumRooms] = useState(4);
  const [aptRoomRent, setAptRoomRent] = useState(10000);
  const [aptRoomType, setAptRoomType] = useState<"studio" | "1BR" | "2BR" | "3BR">("studio");

  // Room form states
  const [roomNumber, setRoomNumber] = useState("");
  const [roomFloor, setRoomFloor] = useState(1);
  const [roomType, setRoomType] = useState<"studio" | "1BR" | "2BR" | "3BR">("studio");
  const [roomRent, setRoomRent] = useState(10000);
  const [roomStatus, setRoomStatus] = useState<"vacant" | "occupied" | "maintenance">("vacant");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomAmenities, setRoomAmenities] = useState("Aircon, Wifi");
  const [roomImages, setRoomImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [roomIsNew, setRoomIsNew] = useState(true);

  // Stats calculation per building
  const getBuildingStats = (aptId: string) => {
    const rooms = db.rooms.filter((r) => r.apartment_id === aptId);
    const total = rooms.length;
    const vacant = rooms.filter((r) => r.status === "vacant").length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const maintenance = rooms.filter((r) => r.status === "maintenance").length;
    return { total, vacant, occupied, maintenance };
  };

  const handleOpenAddApt = () => {
    setEditingApt(null);
    setAptName("");
    setAptAddress("");
    setAptTotalFloors(1);
    setAptDescription("");
    setAptStatus("active");
    setAptNumRooms(4);
    setAptRoomRent(10000);
    setAptRoomType("studio");
    setShowAptDialog(true);
  };

  const handleOpenEditApt = (apt: Apartment) => {
    setEditingApt(apt);
    setAptName(apt.name);
    setAptAddress(apt.address);
    setAptTotalFloors(apt.total_floors);
    setAptDescription(apt.description);
    setAptStatus(apt.status);
    setShowAptDialog(true);
  };

  const handleAptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: aptName,
      address: aptAddress,
      total_floors: Number(aptTotalFloors),
      description: aptDescription,
      status: aptStatus,
    };

    try {
      if (editingApt) {
        await api.updateApartment(editingApt.id, payload);
      } else {
        const createdApt = await api.createApartment(payload);
        if (createdApt && createdApt.id) {
          setSelectedAptId(createdApt.id);
          const numRooms = Number(aptNumRooms);
          if (numRooms > 0) {
            // Generate rooms
            for (let i = 0; i < numRooms; i++) {
              const floor = (i % Number(aptTotalFloors)) + 1;
              const floorRoomCount = Math.floor(i / Number(aptTotalFloors)) + 1;
              const roomNum = `${floor}${floorRoomCount < 10 ? '0' + floorRoomCount : floorRoomCount}`;
              
              const roomPayload = {
                apartment_id: createdApt.id,
                room_number: roomNum,
                floor: floor,
                status: "vacant" as const,
                rent_amount: Number(aptRoomRent),
                room_type: aptRoomType,
                description: `Auto-generated Room ${roomNum} on Floor ${floor}`,
                amenities: "Aircon, Wifi",
                image_url: "",
                is_newly_available: true,
              };
              await api.createRoom(roomPayload);
            }
          }
        }
      }
      setShowAptDialog(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setRoomNumber("");
    setRoomFloor(1);
    setRoomType("studio");
    setRoomRent(12000);
    setRoomStatus("vacant");
    setRoomDescription("");
    setRoomAmenities("Aircon, Wifi");
    setRoomImages([]);
    setRoomIsNew(true);
    setShowRoomDialog(true);
  };

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.room_number);
    setRoomFloor(room.floor);
    setRoomType(room.room_type);
    setRoomRent(room.rent_amount);
    setRoomStatus(room.status);
    setRoomDescription(room.description);
    setRoomAmenities(room.amenities);
    setRoomImages(room.image_url ? room.image_url.split(",").map(s => s.trim()).filter(Boolean) : []);
    setRoomIsNew(room.is_newly_available);
    setShowRoomDialog(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalStatus = roomStatus;
    if (finalStatus !== "maintenance") {
      const hasTenant = editingRoom ? (db.tenants.some(t => t.room_id === editingRoom.id && t.status === "active") || !!editingRoom.tenant_id) : false;
      finalStatus = hasTenant ? "occupied" : "vacant";
    }

    const payload = {
      apartment_id: selectedAptId,
      room_number: roomNumber,
      floor: Number(roomFloor),
      status: finalStatus,
      rent_amount: Number(roomRent),
      room_type: roomType,
      description: roomDescription,
      amenities: roomAmenities,
      image_url: roomImages.join(","),
      is_newly_available: roomIsNew,
    };

    try {
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, payload);
      } else {
        await api.createRoom(payload);
      }
      setShowRoomDialog(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // QR Code URL Generation
  const getQrCodeUrl = (room: Room) => {
    const apt = db.apartments.find((a) => a.id === room.apartment_id);
    const meta = {
      id: room.id,
      roomNumber: room.room_number,
      building: apt?.name || "ApartmentPro Complex",
      address: apt?.address || "Manila",
      rent: `₱${room.rent_amount.toLocaleString()}/mo`,
      type: room.room_type.toUpperCase(),
      amenities: room.amenities,
    };
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify(meta))}`;
  };

  const currentApt = db.apartments.find((a) => a.id === selectedAptId);
  const roomsInCurrentApt = db.rooms.filter((r) => r.apartment_id === selectedAptId);
  const stats = currentApt ? getBuildingStats(currentApt.id) : { total: 0, vacant: 0, occupied: 0, maintenance: 0 };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Apartment Buildings</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Review real estate structures, room assets, and print QR tracking markers.</p>
        </div>
        <button
          onClick={handleOpenAddApt}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white font-bold text-sm rounded-xl shadow-md hover:bg-orange-600 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Building</span>
        </button>
      </div>

      {/* Buildings Tab Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {db.apartments.map((apt) => {
          const aptStats = getBuildingStats(apt.id);
          const isActive = apt.id === selectedAptId;

          return (
            <div
              key={apt.id}
              onClick={() => setSelectedAptId(apt.id)}
              className={`p-6 rounded-2xl cursor-pointer border transition-all flex flex-col justify-between ${
                isActive
                  ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.01]"
                  : "bg-white border-slate-100 hover:border-slate-300 text-slate-800 shadow-sm"
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-4">
                  <div className={`p-2.5 rounded-xl ${isActive ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Building className="w-5 h-5" />
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold tracking-widest rounded uppercase ${
                    apt.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  }`}>
                    {apt.status}
                  </span>
                </div>
                <h3 className="font-extrabold text-base line-clamp-1">{apt.name}</h3>
                <p className={`text-xs mt-1 leading-normal line-clamp-2 font-light ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                  {apt.address}
                </p>
              </div>

              {/* Counts Foot */}
              <div className="mt-6 border-t border-slate-100/10 pt-4 grid grid-cols-3 text-center text-xs font-bold gap-2">
                <div>
                  <span className={`block text-lg font-black ${isActive ? "text-slate-100" : "text-slate-900"}`}>{aptStats.total}</span>
                  <span className={isActive ? "text-slate-400 text-[10px]" : "text-slate-400 text-[10px]"}>Rooms</span>
                </div>
                <div>
                  <span className="block text-lg font-black text-emerald-500">{aptStats.vacant}</span>
                  <span className="text-slate-400 text-[10px]">Vacant</span>
                </div>
                <div>
                  <span className={`block text-lg font-black ${isActive ? "text-brand-orange" : "text-slate-600"}`}>{aptStats.occupied}</span>
                  <span className="text-slate-400 text-[10px]">Occupied</span>
                </div>
              </div>

              {/* Edit Building button */}
              <div className="flex justify-end mt-4 pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditApt(apt);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                    isActive ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Config</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Building Room View */}
      {currentApt && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">Building Selected</span>
              <h2 className="text-xl font-black text-slate-900 mt-1">{currentApt.name}</h2>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-light">{currentApt.description}</p>
            </div>
          </div>

          {/* Rooms List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomsInCurrentApt.length === 0 ? (
              <div className="col-span-full text-center py-16 text-slate-400">
                <Home className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="font-bold">No Rooms Defined</p>
                <p className="text-xs text-slate-400 font-light mt-1">Add first room to populate listing.</p>
              </div>
            ) : (
              roomsInCurrentApt.map((room) => {
                const roomImgs = room.image_url ? room.image_url.split(",").map(s => s.trim()).filter(Boolean) : [];
                const roomImg = roomImgs[0] || ROOM_FALLBACK_IMAGES[room.room_type];
                
                return (
                  <div key={room.id} className="border border-slate-100 hover:border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all group bg-slate-50/50">
                    <div>
                      {/* Thumbnail section */}
                      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                        <img
                          src={roomImg}
                          alt={`Room ${room.room_number}`}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow-sm ${
                            room.status === "vacant" ? "bg-emerald-500 text-white" :
                            room.status === "occupied" ? "bg-brand-orange text-white" :
                            "bg-rose-500 text-white"
                          }`}>
                            {room.status.toUpperCase()}
                          </span>
                          {room.is_newly_available && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded shadow-sm flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> NEW
                            </span>
                          )}
                        </div>
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-md text-white text-[9px] font-mono rounded font-bold uppercase tracking-widest">
                          {room.room_type}
                        </span>
                      </div>

                      {/* Info body */}
                      <div className="p-5 text-sm space-y-3">
                        <div className="flex justify-between items-baseline">
                          <h4 className="font-extrabold text-base text-slate-900">Room {room.room_number}</h4>
                          <span className="font-black text-brand-orange text-lg">₱{Number(room.rent_amount).toLocaleString()}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md">Floor {room.floor}</span>
                          <span>•</span>
                          <span className="truncate">{room.amenities.split(",").slice(0, 3).join(", ")}</span>
                        </div>

                        <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed font-light">
                          {room.description || "No description provided."}
                        </p>

                        {room.status === "occupied" && (() => {
                          const tenant = db.tenants.find((t) => t.room_id === room.id && t.status === "active") || 
                                         db.tenants.find((t) => t.id === room.tenant_id);
                          return tenant ? (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-150 text-xs text-slate-600">
                              <User className="w-3.5 h-3.5 text-brand-orange" />
                              <span>Tenant: <strong className="font-semibold text-slate-800">{tenant.name}</strong></span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Actions foot */}
                    <div className="p-5 border-t border-slate-100 bg-white flex gap-2">
                      <button
                        onClick={() => handleOpenEditRoom(room)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Room</span>
                      </button>
                      <button
                        onClick={() => setQrRoom(room)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
                        title="Display QR Tracking Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Building Dialog */}
      <AnimatePresence>
        {showAptDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAptDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10 text-sm"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-lg font-black text-slate-900">
                  {editingApt ? "Config Building Properties" : "Register New Building Asset"}
                </h3>
                <button onClick={() => setShowAptDialog(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAptSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Building Name</label>
                  <input
                    type="text"
                    required
                    value={aptName}
                    onChange={(e) => setAptName(e.target.value)}
                    placeholder="e.g. ApartmentPro Heights"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Location Address</label>
                  <input
                    type="text"
                    required
                    value={aptAddress}
                    onChange={(e) => setAptAddress(e.target.value)}
                    placeholder="e.g. 123 Quezon Blvd, Manila"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Total Floors</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={aptTotalFloors}
                      onChange={(e) => setAptTotalFloors(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Operating Status</label>
                    <select
                      value={aptStatus}
                      onChange={(e) => setAptStatus(e.target.value as "active" | "inactive")}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    >
                      <option value="active">Active Operation</option>
                      <option value="inactive">Suspended / Decommissioned</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Overview Description</label>
                  <textarea
                    rows={3}
                    value={aptDescription}
                    onChange={(e) => setAptDescription(e.target.value)}
                    placeholder="Provide overview of logistics, proximity to public hubs, etc."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                {!editingApt && (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-4">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Auto-Generate Rooms</span>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1 text-xs">Number of Rooms</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={aptNumRooms}
                          onChange={(e) => setAptNumRooms(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white text-xs font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1 text-xs">Room Type</label>
                        <select
                          value={aptRoomType}
                          onChange={(e) => setAptRoomType(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white text-xs font-medium text-slate-800"
                        >
                          <option value="studio">Studio</option>
                          <option value="1BR">1 Bedroom</option>
                          <option value="2BR">2 Bedrooms</option>
                          <option value="3BR">3 Bedrooms</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1 text-xs">Rent Amount per Room (₱)</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={aptRoomRent}
                        onChange={(e) => setAptRoomRent(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAptDialog(false)}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Processing..." : editingApt ? "Update Building" : "Register Building"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Room Dialog */}
      <AnimatePresence>
        {showRoomDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoomDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10 text-sm overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-lg font-black text-slate-900">
                  {editingRoom ? "Configure Room Parameters" : "Assign New Room Asset"}
                </h3>
                <button onClick={() => setShowRoomDialog(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRoomSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Room Number</label>
                    <input
                      type="text"
                      required
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g. 101"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Floor Level</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={roomFloor}
                      onChange={(e) => setRoomFloor(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Room Classification</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    >
                      <option value="studio">Studio</option>
                      <option value="1BR">1 Bedroom (1BR)</option>
                      <option value="2BR">2 Bedrooms (2BR)</option>
                      <option value="3BR">3 Bedrooms (3BR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Monthly Rent Amount (₱)</label>
                    <input
                      type="number"
                      required
                      value={roomRent}
                      onChange={(e) => setRoomRent(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2">
                  <div className="flex items-center pl-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={roomStatus === "maintenance"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRoomStatus("maintenance");
                          } else {
                            const hasTenant = editingRoom ? (db.tenants.some(t => t.room_id === editingRoom.id && t.status === "active") || !!editingRoom.tenant_id) : false;
                            setRoomStatus(hasTenant ? "occupied" : "vacant");
                          }
                        }}
                        className="w-4.5 h-4.5 accent-brand-orange rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                      />
                      <span className="font-semibold text-slate-700">Under Maintenance</span>
                    </label>
                  </div>
                  <div className="flex items-center pl-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={roomIsNew}
                        onChange={(e) => setRoomIsNew(e.target.checked)}
                        className="w-4.5 h-4.5 accent-brand-orange rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                      />
                      <span className="font-semibold text-slate-700">Newly-Available Listing</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Amenities (comma-separated string)</label>
                  <input
                    type="text"
                    value={roomAmenities}
                    onChange={(e) => setRoomAmenities(e.target.value)}
                    placeholder="Aircon, Wifi, Kitchen, Cabinet"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-slate-700 font-extrabold text-sm">Room Photos ({roomImages.length})</label>
                    <span className="text-[10px] text-slate-400 font-mono">Multiple allowed</span>
                  </div>

                  {/* Thumbnail Row */}
                  {roomImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 border-b border-slate-200/50 pb-3">
                      {roomImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group bg-white shadow-sm">
                          <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setRoomImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                            title="Remove image"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Trigger Area */}
                  <div className="flex gap-2">
                    <label className="flex-1 border-2 border-dashed border-slate-200 hover:border-brand-orange rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white group">
                      <Image className="w-6 h-6 text-slate-400 group-hover:text-brand-orange mb-1" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-brand-orange">
                        {uploadingImages ? "Uploading..." : "Upload Photos"}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Drag & drop or click</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        disabled={uploadingImages}
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          setUploadingImages(true);
                          const newUrls: string[] = [];
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const reader = new FileReader();
                            const promise = new Promise<string>((resolve, reject) => {
                              reader.onload = async (evt) => {
                                try {
                                  const base64 = evt.target?.result as string;
                                  const res = await api.uploadFile(file.name, base64);
                                  resolve(res.url);
                                } catch (err) {
                                  reject(err);
                                }
                              };
                              reader.onerror = reject;
                            });
                            reader.readAsDataURL(file);
                            try {
                              const url = await promise;
                              newUrls.push(url);
                            } catch (err) {
                              console.error("Upload failed for file:", file.name, err);
                            }
                          }
                          setRoomImages(prev => [...prev, ...newUrls]);
                          setUploadingImages(false);
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Manual Add Input */}
                    <div className="w-1/3 flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Or Add URL</span>
                      <input
                        type="text"
                        placeholder="Paste image link..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              setRoomImages(prev => [...prev, val]);
                              e.currentTarget.value = "";
                            }
                          }
                        }}
                        className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800"
                      />
                      <span className="text-[9px] text-slate-400 leading-tight">Press Enter to add url.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Room Specifications Description</label>
                  <textarea
                    rows={2}
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Enter details on room view, dimensions, specific appliances included."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRoomDialog(false)}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Processing..." : editingRoom ? "Update Room" : "Create Room"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal Drawer */}
      <AnimatePresence>
        {qrRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrRoom(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 z-10 text-center text-sm"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-extrabold text-slate-900">Room Tracking QR Code</h3>
                <button onClick={() => setQrRoom(null)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 inline-block mx-auto mb-4">
                <img
                  src={getQrCodeUrl(qrRoom)}
                  alt={`QR Code Room ${qrRoom.room_number}`}
                  className="w-48 h-48 mx-auto shadow-sm border border-white"
                />
              </div>

              <div className="mb-6 space-y-1">
                <h4 className="font-extrabold text-slate-900 text-base">Room {qrRoom.room_number}</h4>
                <p className="text-xs text-slate-400 font-semibold">{db.apartments.find((a) => a.id === qrRoom.apartment_id)?.name}</p>
                <p className="text-xs text-slate-500 font-mono pt-1">
                  Class: {qrRoom.room_type.toUpperCase()} • Rent: ₱{qrRoom.rent_amount.toLocaleString()}
                </p>
              </div>

              {/* Download / Print actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setQrRoom(null)}
                  className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                >
                  Close
                </button>
                <a
                  href={getQrCodeUrl(qrRoom)}
                  download={`Room_${qrRoom.room_number}_QR.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PNG</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
