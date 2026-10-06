import React, { useState } from "react";
import { DBState, api } from "../lib/api";
import { Apartment, Room } from "../types";
import { Building, Plus, Home, Edit3, Trash2, QrCode, Sparkles, X, Check, MapPin, Layers, DollarSign, Image as ImageIcon, Download, Star, Info, User, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PropertyMap from "./PropertyMap";

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

const APARTMENT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
];

export default function Apartments({ db, onRefresh }: ApartmentsProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAptId, setSelectedAptId] = useState<string>(db.apartments[0]?.id || "");

  React.useEffect(() => {
    const active = db.apartments.filter((a) => a.status === "active");
    if ((!selectedAptId || !active.some((a) => a.id === selectedAptId)) && active.length > 0) {
      setSelectedAptId(active[0].id);
    }
  }, [db.apartments, selectedAptId]);

  // Dialog states
  const [showAptDialog, setShowAptDialog] = useState(false);
  const [editingApt, setEditingApt] = useState<Apartment | null>(null);

  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [qrRoom, setQrRoom] = useState<Room | null>(null);
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);

  // Apartment form states
  const [aptName, setAptName] = useState("");
  const [aptAddress, setAptAddress] = useState("");
  const [aptTotalFloors, setAptTotalFloors] = useState(1);
  const [aptDescription, setAptDescription] = useState("");
  const [aptLatitude, setAptLatitude] = useState<number | null>(null);
  const [aptLongitude, setAptLongitude] = useState<number | null>(null);
  const [aptLocationAddress, setAptLocationAddress] = useState("");
  const [aptImageUrl, setAptImageUrl] = useState("");
  const [uploadingAptImage, setUploadingAptImage] = useState(false);
  const [aptNumRooms, setAptNumRooms] = useState(4);

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
    setAptLatitude(null);
    setAptLongitude(null);
    setAptLocationAddress("");
    setAptImageUrl("");
    setAptNumRooms(4);
    setShowAptDialog(true);
  };

  const handleOpenEditApt = (apt: Apartment) => {
    setEditingApt(apt);
    setAptName(apt.name);
    setAptAddress(apt.address);
    setAptTotalFloors(apt.total_floors);
    setAptDescription(apt.description);
    setAptLatitude(Number.isFinite(apt.latitude) ? Number(apt.latitude) : null);
    setAptLongitude(Number.isFinite(apt.longitude) ? Number(apt.longitude) : null);
    setAptLocationAddress(apt.location_address || apt.address || "");
    setAptImageUrl(apt.image_url || "");
    setShowAptDialog(true);
  };

  const handleAptImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingAptImage(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.uploadFile(file.name, base64);
      setAptImageUrl(res.url);
    } catch (err) {
      console.error("Apartment background upload failed:", err);
    } finally {
      setUploadingAptImage(false);
    }
  };

  const handleAptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: aptName,
      address: aptAddress,
      total_floors: Number(aptTotalFloors),
      description: aptDescription,
      status: "active" as const,
      latitude: aptLatitude ?? undefined,
      longitude: aptLongitude ?? undefined,
      location_address: aptLocationAddress || aptAddress,
      image_url: aptImageUrl || undefined,
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
            // Generate rooms without requiring roomtype or rent upfront
            for (let i = 0; i < numRooms; i++) {
              const floor = (i % Number(aptTotalFloors)) + 1;
              const floorRoomCount = Math.floor(i / Number(aptTotalFloors)) + 1;
              const roomNum = `${floor}${floorRoomCount < 10 ? "0" + floorRoomCount : floorRoomCount}`;

              const roomPayload = {
                apartment_id: createdApt.id,
                room_number: roomNum,
                floor: floor,
                status: "vacant" as const,
                rent_amount: 0,
                room_type: "studio" as const,
                description: `Room ${roomNum} on Floor ${floor}`,
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
    setRoomRent(10000);
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
    setRoomImages(room.image_url ? room.image_url.split(",").map((s) => s.trim()).filter(Boolean) : []);
    setRoomIsNew(room.is_newly_available);
    setShowRoomDialog(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalStatus = roomStatus;
    if (finalStatus !== "maintenance") {
      const hasActiveTenant = editingRoom
        ? db.tenants.some((t) => t.room_id === editingRoom.id && t.status === "active")
        : false;
      finalStatus = hasActiveTenant ? "occupied" : "vacant";
    }

    // A room with no active tenant cannot remain occupied. This also clears stale tenant assignments.
    if (editingRoom && !db.tenants.some((t) => t.room_id === editingRoom.id && t.status === "active")) {
      finalStatus = "vacant";
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

  const getQrCodeUrl = (room: Room) => {
    const apt = db.apartments.find((a) => a.id === room.apartment_id);
    const meta = {
      id: room.id,
      roomNumber: room.room_number || "N/A",
      building: apt?.name || "RentFlow Complex",
      address: apt?.address || "Manila",
      rent: `₱${(Number(room.rent_amount) || 0).toLocaleString()}/mo`,
      type: (room.room_type || "studio").toUpperCase(),
      amenities: room.amenities || "Aircon, Wifi",
    };
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify(meta))}`;
  };

  // Suspended/inactive buildings are intentionally hidden from the Buildings & Rooms page.
  const activeApartments = db.apartments.filter((apt) => apt.status === "active");
  const currentApt = activeApartments.find((a) => a.id === selectedAptId) || activeApartments[0];
  const roomsInCurrentApt = currentApt ? db.rooms.filter((r) => r.apartment_id === currentApt.id) : [];

  return (
    <div className="space-y-4">
      {/* Header section - compact */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Apartment Buildings</h1>
          <p className="text-slate-500 text-xs">Manage properties, background covers, and room assets.</p>
        </div>
        <button
          onClick={handleOpenAddApt}
          className="neu-btn flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Building</span>
        </button>
      </div>

      {/* Apartment Buildings Grid - Bigger Cards with Photo Covering Entire Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {activeApartments.length === 0 ? (
          <div className="col-span-full neu-card text-center py-12 text-slate-400">
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-sm text-slate-600">No Apartment Buildings</p>
            <p className="text-xs text-slate-400 font-light mt-0.5">Click "Add Building" to create your first property.</p>
          </div>
        ) : (
          activeApartments.map((apt, idx) => {
            const aptStats = getBuildingStats(apt.id);
            const isActive = apt.id === selectedAptId;
            const bgImage = apt.image_url || APARTMENT_FALLBACK_IMAGES[idx % APARTMENT_FALLBACK_IMAGES.length];

            return (
              <div
                key={apt.id}
                onClick={() => setSelectedAptId(apt.id)}
                className={`relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[230px] sm:min-h-[250px] p-4 group select-none shadow-md ${
                  isActive
                    ? "ring-3 ring-[#EF6905] ring-offset-2 ring-offset-slate-100 shadow-xl scale-[1.01]"
                    : "hover:shadow-xl hover:scale-[1.01]"
                }`}
              >
                {/* Photo Covering Entire Card */}
                <img
                  src={bgImage}
                  alt={apt.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/35 group-hover:via-slate-950/70 transition-colors" />

                {/* Top Row: Status badge & Config Action */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 text-[9px] font-extrabold tracking-wider rounded-lg uppercase backdrop-blur-md border bg-emerald-500/80 text-white border-emerald-400/40">
                    Active Operation
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditApt(apt);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg font-bold bg-black/45 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all shadow-xs"
                    title="Configure Building Details"
                  >
                    <Edit3 className="w-3 h-3 text-white" />
                    <span>Config</span>
                  </button>
                </div>

                {/* Bottom Row: Name, Address, and Stats */}
                <div className="relative z-10 space-y-2.5">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="p-1 rounded-md bg-white/20 backdrop-blur-xs text-white">
                        <Building className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-black text-base sm:text-lg text-white line-clamp-1 drop-shadow-xs">
                        {apt.name}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-200 line-clamp-1 flex items-center gap-1.5 drop-shadow-xs">
                      <MapPin className="w-3 h-3 text-brand-orange shrink-0" />
                      <span className="truncate">{apt.address}</span>
                    </p>
                  </div>

                  {/* Counts Foot - Glassmorphic Stats */}
                  <div className="pt-2 border-t border-white/20 grid grid-cols-3 text-center text-xs font-bold gap-1.5">
                    <div className="bg-white/10 backdrop-blur-md border border-white/15 py-1 px-1 rounded-lg">
                      <span className="block text-xs font-black text-white">{aptStats.total}</span>
                      <span className="text-slate-300 text-[9px] uppercase tracking-wider">Rooms</span>
                    </div>
                    <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 py-1 px-1 rounded-lg">
                      <span className="block text-xs font-black text-emerald-300">{aptStats.vacant}</span>
                      <span className="text-emerald-200 text-[9px] uppercase tracking-wider">Vacant</span>
                    </div>
                    <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 py-1 px-1 rounded-lg">
                      <span className="block text-xs font-black text-orange-300">{aptStats.occupied}</span>
                      <span className="text-orange-200 text-[9px] uppercase tracking-wider">Occupied</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Building Room View - Clean without maps */}
      {currentApt && (
        <div className="space-y-4 pt-3 border-t border-slate-200/80">
          {/* Header Card with Background cover & Complex Details - NO add room button or edit building button */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white p-4 sm:p-5 shadow-sm">
            {currentApt.image_url && (
              <img
                src={currentApt.image_url}
                alt={currentApt.name}
                className="absolute inset-0 w-full h-full object-cover opacity-25"
              />
            )}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/20 px-2.5 py-0.5 rounded-full border border-brand-orange/30">
                    Active Complex
                  </span>
                  <span className="text-xs text-slate-300">
                    {currentApt.total_floors} Floors • {roomsInCurrentApt.length} Units ({getBuildingStats(currentApt.id).vacant} Vacant)
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">{currentApt.name}</h3>
                <p className="text-xs text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                  <span>{currentApt.location_address || currentApt.address || "No address specified"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Rooms Grid - Bigger Cards & No QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {roomsInCurrentApt.length === 0 ? (
              <div className="col-span-full text-center py-14 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                <Home className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-700">No Rooms Assigned</p>
                <p className="text-xs text-slate-400 font-light mt-0.5">There are no units registered under this building yet.</p>
              </div>
            ) : (
              roomsInCurrentApt.map((room) => {
                const roomImgs = room.image_url ? room.image_url.split(",").map((s) => s.trim()).filter(Boolean) : [];
                const roomType = (room.room_type || "studio") as keyof typeof ROOM_FALLBACK_IMAGES;
                const roomImg = roomImgs[0] || ROOM_FALLBACK_IMAGES[roomType] || ROOM_FALLBACK_IMAGES.studio;
                const roomAmenitiesList = (room.amenities || "Aircon, Wifi").split(",").map((s) => s.trim()).filter(Boolean);
                const roomStatus = (room.status || "vacant") as "vacant" | "occupied" | "maintenance";

                return (
                  <div
                    key={room.id}
                    onClick={() => setViewingRoom(room)}
                    className="border border-slate-200/90 hover:border-brand-orange/60 rounded-xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all group bg-white cursor-pointer"
                  >
                    <div>
                      {/* Room Thumbnail section - Bigger */}
                      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                        <img
                          src={roomImg}
                          alt={`Room ${room.room_number || "Unit"}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded shadow-xs ${
                              roomStatus === "vacant"
                                ? "bg-emerald-500 text-white"
                                : roomStatus === "occupied"
                                ? "bg-brand-orange text-white"
                                : "bg-rose-500 text-white"
                            }`}
                          >
                            {roomStatus.toUpperCase()}
                          </span>
                          {room.is_newly_available && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded shadow-xs flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> NEW
                            </span>
                          )}
                        </div>
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono rounded font-bold uppercase tracking-wider">
                          {roomType}
                        </span>
                      </div>

                      {/* Info body - comfortable size */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between items-baseline gap-1.5">
                          <h4 className="font-black text-sm text-slate-900 truncate">Room {room.room_number || "Unit"}</h4>
                          <span className="font-black text-brand-orange text-sm shrink-0">
                            ₱{(Number(room.rent_amount) || 0).toLocaleString()}
                            <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Floor {room.floor ?? 1}</span>
                          <span>•</span>
                          <span className="truncate">{roomAmenitiesList.slice(0, 2).join(", ") || "Standard Amenities"}</span>
                        </div>

                        {roomStatus === "occupied" && (() => {
                          const tenant =
                            db.tenants.find((t) => t.room_id === room.id && t.status === "active") ||
                            db.tenants.find((t) => t.id === room.tenant_id);
                          return tenant ? (
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-xs text-slate-600 truncate">
                              <User className="w-3 h-3 text-brand-orange shrink-0" />
                              <span className="truncate font-semibold text-slate-700">{tenant.name}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Actions foot - Edit only (NO QR code) */}
                    <div className="p-2 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditRoom(room);
                        }}
                        className="w-full py-1.5 px-2 bg-gradient-to-r from-[#8B2626] to-[#EF6905] hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95"
                        title="Edit Room"
                      >
                        <Edit3 className="w-3 h-3 text-white" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Building Properties Modal - Compact with Background Upload & without RoomType/Rent */}
      <AnimatePresence>
        {showAptDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAptDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white w-full max-w-md max-h-[92vh] rounded-2xl shadow-2xl z-10 text-xs overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-slate-100 px-4 py-3 shrink-0">
                <h3 className="text-sm font-black text-slate-900">
                  {editingApt ? "Edit Building Asset" : "Register New Building"}
                </h3>
                <button
                  onClick={() => setShowAptDialog(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAptSubmit} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Building Name</label>
                  <input
                    type="text"
                    required
                    value={aptName}
                    onChange={(e) => setAptName(e.target.value)}
                    placeholder="e.g. Sunset Heights Complex"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Location Address</label>
                  <input
                    type="text"
                    required
                    value={aptAddress}
                    onChange={(e) => setAptAddress(e.target.value)}
                    placeholder="e.g. 123 Quezon Ave, Pagadian City"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                  />
                </div>

                {/* Exact Apartment Location Picker */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Exact Map Location</label>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Click the map to place the apartment pin. You can drag the pin to fine-tune the exact location.
                    </p>
                  </div>
                  <PropertyMap
                    value={
                      aptLatitude !== null && aptLongitude !== null
                        ? { lat: aptLatitude, lng: aptLongitude }
                        : null
                    }
                    interactive
                    height={260}
                    zoom={15}
                    onChange={(point) => {
                      setAptLatitude(point.lat);
                      setAptLongitude(point.lng);
                      if (point.address) {
                        setAptLocationAddress(point.address);
                        setAptAddress((current) => current.trim() ? current : point.address || current);
                      }
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Latitude</span>
                      <span className="font-mono text-[11px] text-slate-700">
                        {aptLatitude !== null ? aptLatitude.toFixed(6) : "Not selected"}
                      </span>
                    </div>
                    <div className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Longitude</span>
                      <span className="font-mono text-[11px] text-slate-700">
                        {aptLongitude !== null ? aptLongitude.toFixed(6) : "Not selected"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Apartment Background Image Upload */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 font-bold">Apartment Background Image</label>
                    {uploadingAptImage && (
                      <span className="text-[10px] text-brand-orange font-medium flex items-center gap-1">
                        <UploadCloud className="w-3 h-3 animate-bounce" /> Uploading...
                      </span>
                    )}
                  </div>

                  {aptImageUrl ? (
                    <div className="relative h-24 w-full rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={aptImageUrl} alt="Background Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAptImageUrl("")}
                          className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-brand-orange/60 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white">
                      <ImageIcon className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-[11px] font-bold text-slate-700">Click to Upload Background Photo</span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingAptImage}
                        onChange={handleAptImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Manual URL input fallback */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Or paste background image URL..."
                      value={aptImageUrl}
                      onChange={(e) => setAptImageUrl(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 bg-white"
                    />
                    {aptImageUrl && (
                      <button
                        type="button"
                        onClick={() => setAptImageUrl("")}
                        className="px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded text-[10px] font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Total Floors</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={aptTotalFloors}
                      onChange={(e) => setAptTotalFloors(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Overview Description</label>
                  <textarea
                    rows={2}
                    value={aptDescription}
                    onChange={(e) => setAptDescription(e.target.value)}
                    placeholder="Short description of the property, features, or location."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                  />
                </div>

                {/* Auto Generate Rooms: Simplified without RoomType and Rent Amount */}
                {!editingApt && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                   
                   
                    <div className="pt-1">
                      <label className="block text-slate-700 font-bold mb-1 text-[11px]">Number of Units</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={aptNumRooms}
                        onChange={(e) => setAptNumRooms(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange bg-white text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowAptDialog(false)}
                    className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingAptImage}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-all active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : editingApt ? "Save Building" : "Register Building"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Room Drawer / Modal - Compact Form */}
      <AnimatePresence>
        {showRoomDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoomDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white w-full max-w-md max-h-[92vh] rounded-2xl shadow-2xl z-10 text-xs overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-slate-100 px-4 py-3 shrink-0">
                <h3 className="text-sm font-black text-slate-900">
                  {editingRoom ? `Edit Room ${editingRoom.room_number}` : "Configure New Room"}
                </h3>
                <button
                  onClick={() => setShowRoomDialog(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRoomSubmit} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Room Number / Identifier</label>
                    <input
                      type="text"
                      required
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g. 101 or 2A"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Floor Level</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={currentApt ? currentApt.total_floors : 50}
                      value={roomFloor}
                      onChange={(e) => setRoomFloor(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Room Type</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    >
                      <option value="studio">Studio</option>
                      <option value="1BR">1 Bedroom</option>
                      <option value="2BR">2 Bedrooms</option>
                      <option value="3BR">3 Bedrooms</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Monthly Rent (₱)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={roomRent}
                      onChange={(e) => setRoomRent(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Room State</label>
                    <select
                      value={roomStatus}
                      onChange={(e) => setRoomStatus(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                    >
                      <option value="vacant">Vacant (Available)</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Under Maintenance</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={roomIsNew}
                        onChange={(e) => setRoomIsNew(e.target.checked)}
                        className="rounded text-brand-orange focus:ring-brand-orange w-3.5 h-3.5"
                      />
                      <span className="font-bold text-slate-700 text-xs">Mark as Newly Listed</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Amenities</label>
                  <input
                    type="text"
                    value={roomAmenities}
                    onChange={(e) => setRoomAmenities(e.target.value)}
                    placeholder="e.g. Aircon, High-speed Wifi, Hot Shower"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                  />
                </div>

                {/* Multiple Images Upload & Gallery */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-slate-700 font-bold">Room Photos Gallery</label>
                    {uploadingImages && (
                      <span className="text-[10px] text-brand-orange font-medium flex items-center gap-1">
                        <UploadCloud className="w-3 h-3 animate-bounce" /> Uploading...
                      </span>
                    )}
                  </div>

                  {roomImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      {roomImages.map((imgUrl, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                          <img src={imgUrl} alt={`Room ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setRoomImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-rose-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="border border-dashed border-slate-300 hover:border-brand-orange rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">Upload Room Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
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
                        setRoomImages((prev) => [...prev, ...newUrls]);
                        setUploadingImages(false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Room Description</label>
                  <textarea
                    rows={2}
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Details on room orientation, inclusions, etc."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange font-medium text-slate-800 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRoomDialog(false)}
                    className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImages}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-all active:scale-98 disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrRoom(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-xs rounded-2xl shadow-2xl p-4 z-10 text-center text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                <h3 className="font-extrabold text-slate-900 text-xs">Room QR Code</h3>
                <button onClick={() => setQrRoom(null)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block mx-auto mb-3">
                <img
                  src={getQrCodeUrl(qrRoom)}
                  alt={`QR Code Room ${qrRoom.room_number}`}
                  className="w-36 h-36 mx-auto shadow-xs border border-white"
                />
              </div>

              <div className="mb-4 space-y-0.5">
                <h4 className="font-extrabold text-slate-900 text-sm">Room {qrRoom.room_number}</h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  {db.apartments.find((a) => a.id === qrRoom.apartment_id)?.name}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  {qrRoom.room_type.toUpperCase()} • ₱{(Number(qrRoom.rent_amount) || 0).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQrRoom(null)}
                  className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-all"
                >
                  Close
                </button>
                <a
                  href={getQrCodeUrl(qrRoom)}
                  download={`Room_${qrRoom.room_number}_QR.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Small Room Quick-View Card Modal */}
      <AnimatePresence>
        {viewingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingRoom(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden z-10 text-xs"
            >
              {(() => {
                const roomImgs = viewingRoom.image_url ? viewingRoom.image_url.split(",").map((s) => s.trim()).filter(Boolean) : [];
                const rType = (viewingRoom.room_type || "studio") as keyof typeof ROOM_FALLBACK_IMAGES;
                const rImg = roomImgs[0] || ROOM_FALLBACK_IMAGES[rType] || ROOM_FALLBACK_IMAGES.studio;
                const aptObj = db.apartments.find((a) => a.id === viewingRoom.apartment_id);
                const tenant = db.tenants.find((t) => t.room_id === viewingRoom.id && t.status === "active") || db.tenants.find((t) => t.id === viewingRoom.tenant_id);

                return (
                  <div>
                    {/* Compact Image Area */}
                    <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                      <img src={rImg} alt={`Room ${viewingRoom.room_number}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded ${
                          viewingRoom.status === "vacant"
                            ? "bg-emerald-500 text-white"
                            : viewingRoom.status === "occupied"
                            ? "bg-brand-orange text-white"
                            : "bg-rose-500 text-white"
                        }`}>
                          {viewingRoom.status}
                        </span>
                        <span className="px-1.5 py-0.5 bg-black/70 text-white text-[8px] font-mono rounded font-bold uppercase">
                          {viewingRoom.room_type}
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-3 right-3 text-white">
                        <div className="flex justify-between items-end">
                          <div>
                            <h3 className="font-black text-sm text-white">Room {viewingRoom.room_number}</h3>
                            <p className="text-[10px] text-slate-300 truncate">{aptObj?.name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-slate-300 block">Monthly Rate</span>
                            <span className="font-black text-sm text-brand-orange">
                              ₱{(Number(viewingRoom.rent_amount) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-2.5">
                      {/* Specs pills */}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center gap-1.5">
                          <Building className="w-3 h-3 text-brand-orange shrink-0" />
                          <span className="font-semibold text-slate-700">Floor {viewingRoom.floor}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center gap-1.5 truncate">
                          <MapPin className="w-3 h-3 text-brand-orange shrink-0" />
                          <span className="font-semibold text-slate-700 truncate">{aptObj?.address || "Building Asset"}</span>
                        </div>
                      </div>

                      {/* Tenant status if occupied */}
                      {tenant && (
                        <div className="bg-orange-50/70 border border-orange-100 p-2 rounded-lg text-[10px] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-500">Current Tenant: </span>
                            <strong className="text-slate-800 font-bold">{tenant.name}</strong>
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      {viewingRoom.description && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                          <p className="text-slate-600 text-[10px] leading-relaxed font-light mt-0.5 line-clamp-3">
                            {viewingRoom.description}
                          </p>
                        </div>
                      )}

                      {/* Amenities */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amenities</span>
                        <div className="flex flex-wrap gap-1">
                          {(viewingRoom.amenities || "Aircon, Wifi").split(",").map((a, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] rounded font-medium border border-slate-200/50">
                              {a.trim()}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            const r = viewingRoom;
                            setViewingRoom(null);
                            handleOpenEditRoom(r);
                          }}
                          className="flex-1 py-1.5 bg-gradient-to-r from-[#8B2626] to-[#EF6905] hover:opacity-90 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3 h-3 text-white" />
                          <span>Edit Unit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
