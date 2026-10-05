import React, { useState, useEffect, useRef } from "react";
import { Apartment, Room, Inquiry } from "../types";
import { api, DBState } from "../lib/api";
import { Building, MapPin, Search, Eye, MessageCircle, Star, Phone, Mail, Clock, Calendar, Check, X, Shield, ArrowRight, Heart, ChevronLeft, ChevronRight, Users, MessageSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PropertyMap from "./PropertyMap";

const ROOM_TYPE_LABELS = {
  studio: "Studio",
  "1BR": "1 Bedroom",
  "2BR": "2 Bedrooms",
  "3BR": "3 Bedrooms",
};

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
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80"
];

interface RoomCardProps {
  room: Room;
  apt: Apartment | null | undefined;
  inquiryCount?: number;
  onSelect: (room: Room) => void;
  key?: string | number;
}

function RoomCard({ room, apt, inquiryCount = 0, onSelect }: RoomCardProps) {
  const roomImgs = room.image_url ? room.image_url.split(",").map(s => s.trim()).filter(Boolean) : [];
  const displayImages = roomImgs.length > 0 ? roomImgs : [ROOM_FALLBACK_IMAGES[room.room_type] || ROOM_FALLBACK_IMAGES.studio];
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardSwipeStartX = useRef<number | null>(null);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
    >
      <div>
        {/* Card Image Area with Carousel - Compact */}
        <div 
          className="relative aspect-[16/9] overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={(e) => {
            cardSwipeStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (cardSwipeStartX.current === null) return;
            const diff = cardSwipeStartX.current - e.changedTouches[0].clientX;
            const minSwipeDistance = 40;
            if (diff > minSwipeDistance) {
              setCurrentIndex((prev) => (prev + 1) % displayImages.length);
            } else if (diff < -minSwipeDistance) {
              setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
            }
            cardSwipeStartX.current = null;
          }}
          onMouseDown={(e) => {
            cardSwipeStartX.current = e.clientX;
          }}
          onMouseUp={(e) => {
            if (cardSwipeStartX.current === null) return;
            const diff = cardSwipeStartX.current - e.clientX;
            const minSwipeDistance = 40;
            if (diff > minSwipeDistance) {
              setCurrentIndex((prev) => (prev + 1) % displayImages.length);
            } else if (diff < -minSwipeDistance) {
              setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
            }
            cardSwipeStartX.current = null;
          }}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentIndex}
              src={displayImages[currentIndex]}
              alt={`Room ${room.room_number}`}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          
          {/* Navigation Arrows */}
          {displayImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 bg-black/50 hover:bg-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 duration-200 shadow-xs z-10"
                title="Previous Photo"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-black/50 hover:bg-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 duration-200 shadow-xs z-10"
                title="Next Photo"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Dots Indicator Overlay */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10 py-0.5 px-1.5 rounded-full bg-black/40 backdrop-blur-xs">
              {displayImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-1 h-1 rounded-full transition-all ${
                    idx === currentIndex ? "bg-brand-orange w-2" : "bg-white/60 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Status/New Badges */}
          <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-0.5 pointer-events-none">
            <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[8px] font-bold rounded shadow-xs">
              Available
            </span>
            {room.is_newly_available && (
              <span className="flex items-center gap-0.5 px-1 py-0.2 bg-amber-500 text-white text-[8px] font-bold rounded shadow-xs">
                <Star className="w-2 h-2 fill-current" /> New
              </span>
            )}
            {inquiryCount > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-600/90 text-white text-[8px] font-bold rounded shadow-xs backdrop-blur-xs">
                <Users className="w-2 h-2" /> {inquiryCount} {inquiryCount === 1 ? "inquiry" : "inquiries"}
              </span>
            )}
          </div>

          {/* Room Type Pill */}
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 bg-black/75 backdrop-blur-xs text-white text-[8px] font-bold rounded uppercase tracking-wider pointer-events-none">
            {ROOM_TYPE_LABELS[room.room_type]}
          </span>
        </div>

        {/* Card Content - Slightly bigger & comfortable */}
        <div className="p-3 text-xs space-y-1.5">
          {/* Price & Title Section */}
          <div className="flex justify-between items-baseline gap-1.5">
            <h3 className="text-sm font-black text-slate-900 truncate">Room {room.room_number}</h3>
            <div className="text-brand-orange font-black text-sm shrink-0">
              ₱{Number(room.rent_amount).toLocaleString()}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
            </div>
          </div>

          {/* Inquiry Number Counter for Room */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
            <Users className="w-3 h-3 text-brand-orange shrink-0" />
            <span>
              <strong>{inquiryCount}</strong> {inquiryCount === 1 ? "person inquired" : "people inquired"}
            </span>
          </div>

          {/* Building Name and Floor */}
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium truncate">
            <Building className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{apt?.name || "RentFlow"}</span>
            <span className="text-slate-300">•</span>
            <span>Flr {room.floor}</span>
          </div>

          {/* Address */}
          {apt?.address && (
            <div className="flex items-center gap-1 text-slate-400 text-[11px] truncate">
              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span className="truncate">{apt.address}</span>
            </div>
          )}

          {/* Description */}
          {room.description && (
            <p className="text-slate-500 text-[11px] line-clamp-1 leading-snug font-light">
              {room.description}
            </p>
          )}

          {/* Amenities Pills */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {(room.amenities || "Aircon, Wifi").split(",").slice(0, 2).map((amenity, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-medium rounded-md border border-slate-200/50"
              >
                {amenity.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-3 pt-0">
        <button
          onClick={() => onSelect(room)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-brand-orange text-white font-bold text-xs rounded-lg shadow-xs transition-colors active:scale-95"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Room & Inquire</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [db, setDb] = useState<DBState | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedRoom]);
  
  // Inquiry form states
  const [inqName, setInqName] = useState("");
  const [inqEmail, setInqEmail] = useState("");
  const [inqPhone, setInqPhone] = useState("");
  const [inqMessage, setInqMessage] = useState("");
  const [inqDate, setInqDate] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getDB();
      setDb(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getApartmentForRoom = (roomId: string) => {
    const room = db?.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    return db?.apartments.find((a) => a.id === room.apartment_id) || null;
  };

  // Only display vacant rooms in the public listings
  const vacantRooms = db?.rooms.filter((room) => room.status === "vacant") || [];

  const filteredRooms = vacantRooms.filter((room) => {
    const apt = getApartmentForRoom(room.id);
    const aptName = apt?.name || "";
    const aptAddress = apt?.address || "";
    const rNum = room.room_number || "";
    const rDesc = room.description || "";
    const rAmen = room.amenities || "";
    const matchesSearch =
      rNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rAmen.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || room.room_type === selectedType;
    const matchesBuilding = selectedBuilding === "all" || room.apartment_id === selectedBuilding;

    return matchesSearch && matchesType && matchesBuilding;
  });

  const getVacantRoomCount = (aptId: string) => {
    return vacantRooms.filter((r) => r.apartment_id === aptId).length;
  };

  // Only display active apartments that currently have at least one vacant room available (hide occupied apartments)
  const activeApartments = (db?.apartments || []).filter(
    (apt) => apt.status === "active" && getVacantRoomCount(apt.id) > 0
  );

  const filteredApartments = activeApartments.filter((apt) => {
    const matchesSearch =
      apt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Also see if any vacant rooms in this building match the search term or room type
    const matchingRooms = vacantRooms.filter((room) => {
      if (room.apartment_id !== apt.id) return false;

      const matchesType = selectedType === "all" || room.room_type === selectedType;
      const matchesRoomSearch = searchQuery === "" ||
        (room.room_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.amenities || "").toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesRoomSearch;
    });

    if (selectedType !== "all") {
      return matchingRooms.length > 0;
    }

    if (searchQuery !== "") {
      return matchesSearch || matchingRooms.length > 0;
    }

    return true;
  });

  const selectedApt = db?.apartments.find((a) => a.id === selectedBuilding) || null;

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    const apt = getApartmentForRoom(selectedRoom.id);
    setSubmittingInquiry(true);

    try {
      await api.createInquiry({
        name: inqName,
        email: inqEmail,
        phone: inqPhone,
        room_id: selectedRoom.id,
        room_number: selectedRoom.room_number,
        apartment_name: apt?.name || "RentFlow Complex",
        message: inqMessage || `Inquiry about Room ${selectedRoom.room_number}.`,
        preferred_visit_date: inqDate,
        status: "new",
      });
      setInquirySuccess(true);
      setTimeout(() => {
        setInquirySuccess(false);
        // Clear fields
        setInqName("");
        setInqEmail("");
        setInqPhone("");
        setInqMessage("");
        setInqDate("");
      }, 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to submit inquiry. Please try again.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#8B2626] text-white rounded-xl shadow-md">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight text-[#2c1a11]">
                  Apartment<span className="text-[#EF6905]">Pro</span>
                </span>
                <span className="block text-[9px] text-[#8c6753] font-mono tracking-wider -mt-1 font-semibold">PROPERTY PLATFORM</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#listings" className="text-[#44281d] hover:text-[#EF6905] font-medium transition-colors">Browse Rooms</a>
              <a href="#about" className="text-[#44281d] hover:text-[#EF6905] font-medium transition-colors">About</a>
              <a href="#contact" className="text-[#44281d] hover:text-[#EF6905] font-medium transition-colors">Contact</a>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="#listings"
                className="flex items-center gap-2 px-4 py-2.5 neu-btn text-slate-900 font-bold text-sm rounded-xl shadow-xs transition-all"
              >
                <span>Inquire Online</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-[#23140e] text-white py-24 sm:py-32 overflow-hidden border-b border-[#8B2626]/30">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80"
            alt="Apartment building exterior"
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#23140e] via-[#23140e]/90 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EF6905]/20 text-[#F1E5A1] border border-[#EF6905]/40 rounded-full text-xs font-semibold tracking-wider uppercase mb-6">
              <Star className="w-3.5 h-3.5 fill-current" /> Premium Rental Properties
            </span>
         <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 text-white drop-shadow-lg">
  Find Your Next Home in <br />
  <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">
    Ultimate Comfort
  </span>
</h1>
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-[#ecd9c6] mb-10 font-light">
              Explore premium, fully-vetted vacant apartments with transparent billing, modern amenities, and dedicated on-site customer assistance.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Available Room Listings Grid */}
      <div id="listings" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-orange rounded-full animate-spin" />
            <p className="text-slate-500 font-semibold mt-4">Loading active listings...</p>
          </div>
        ) : selectedBuilding === "all" ? (
          // ---------------- STEP 1: CHOOSE AN APARTMENT BUILDING ----------------
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10">
              <div>
                <span className="text-xs font-extrabold text-brand-orange uppercase tracking-widest">Step 1: Choose Your Residence</span>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mt-1">Our Apartment Buildings</h2>
                <p className="text-slate-500 mt-1">Select an apartment building to explore its available rooms.</p>
              </div>
              <div className="px-4 py-2 bg-slate-100 rounded-xl text-slate-700 font-semibold text-sm">
                {filteredApartments.length} {filteredApartments.length === 1 ? "building found" : "buildings found"}
              </div>
            </div>

            {filteredApartments.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-xs">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No Buildings Found</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">There are no active apartment buildings listed at the moment. Please contact the office or check back later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredApartments.map((apt, idx) => {
                  const vacantCount = getVacantRoomCount(apt.id);
                  const displayImage = (apt as any).image_url || APARTMENT_FALLBACK_IMAGES[idx % APARTMENT_FALLBACK_IMAGES.length];
                  const aptRooms = (db?.rooms || []).filter((r) => r.apartment_id === apt.id);
                  const aptRoomIdSet = new Set(aptRooms.map((r) => r.id));
                  const aptInquiriesCount = (db?.inquiries || []).filter(
                    (inq) => inq.apartment_name === apt.name || aptRoomIdSet.has(inq.room_id)
                  ).length;
                  return (
                    <motion.div
                      key={apt.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => {
                        setSelectedBuilding(apt.id);
                        document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group min-h-[240px] sm:min-h-[260px] p-4 select-none"
                    >
                      {/* Apartment Photo Covering Entire Card */}
                      <img
                        src={displayImage}
                        alt={apt.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/30 group-hover:via-slate-950/70 transition-colors" />

                      {/* Top Row: Vacant badge & Inquiry Counter */}
                      <div className="relative z-10 flex items-center justify-between gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg shadow-xs backdrop-blur-md border ${
                          vacantCount > 0 ? "bg-emerald-500/80 text-white border-emerald-400/40" : "bg-slate-700/80 text-slate-200 border-white/10"
                        }`}>
                          {vacantCount > 0 ? `${vacantCount} Vacant Unit${vacantCount > 1 ? "s" : ""}` : "Fully Occupied"}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-200 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-amber-400/30 flex items-center gap-1 shadow-xs">
                            <MessageSquare className="w-3 h-3 text-brand-orange" />
                            {aptInquiriesCount} {aptInquiriesCount === 1 ? "Inquiry" : "Inquiries"}
                          </span>
                          <span className="text-[10px] font-medium text-white/80 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                            {apt.total_floors} Floors
                          </span>
                        </div>
                      </div>

                      {/* Bottom Content */}
                      <div className="relative z-10 space-y-2">
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-white group-hover:text-brand-orange transition-colors line-clamp-1 drop-shadow-xs">
                            {apt.name}
                          </h3>
                          
                          <div className="flex items-center gap-1.5 text-slate-200 text-xs mt-0.5 line-clamp-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                            <span className="truncate">{apt.address}</span>
                          </div>
                        </div>

                        {apt.description && (
                          <p className="text-slate-300 text-xs font-light line-clamp-2 leading-snug">
                            {apt.description}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 text-[11px] text-amber-200 font-semibold bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-md border border-white/10 w-fit">
                          <Users className="w-3 h-3 text-brand-orange shrink-0" />
                          <span>{aptInquiriesCount} {aptInquiriesCount === 1 ? "person has" : "people have"} inquired</span>
                        </div>

                        <div className="border-t border-white/20 pt-2 flex items-center justify-between text-xs font-bold text-white">
                          <span className="text-[11px] text-slate-300 font-normal">Explore Units</span>
                          <span className="text-brand-orange font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            View Rooms <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          // ---------------- STEP 2: CHOOSE A ROOM WITHIN SELECTED BUILDING ----------------
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 mb-6">
              <div>
                <span className="text-[10px] font-extrabold text-brand-orange uppercase tracking-widest">Step 2: Choose Your Room</span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Available Rooms in Building</h3>
                <p className="text-slate-500 text-xs mt-0.5">Select a room to view details and submit an inquiry.</p>
              </div>
              <div className="px-3 py-1 bg-slate-100 rounded-lg text-slate-700 font-semibold text-xs">
                {filteredRooms.length} {filteredRooms.length === 1 ? "room available" : "rooms available"}
              </div>
            </div>

            {/* Building Info Hero Card and Rooms Grid */}
            {(() => {
              const selectedApt = db?.apartments.find((a) => a.id === selectedBuilding);

              return (
                <div className="space-y-5">
                  {/* Building Info Card Banner */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-md">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <img
                        src={(selectedApt as any)?.image_url || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"}
                        alt="Apartment overlay"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="relative z-10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setSelectedBuilding("all")}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-orange uppercase tracking-wider hover:text-orange-400 transition-colors bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg border border-white/10"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Back to Buildings
                        </button>
                        <div className="flex items-center gap-2">
                          {selectedApt && (
                            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-brand-orange" />
                              {(db?.inquiries || []).filter(inq => inq.apartment_name === selectedApt.name || (filteredRooms || []).some(r => r.id === inq.room_id)).length} Inquiries
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded uppercase tracking-wider">
                            {filteredRooms.length} Vacant Units
                          </span>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">{selectedApt?.name}</h2>
                        {selectedApt?.description && (
                          <p className="text-slate-300 font-light text-xs mt-1 leading-snug line-clamp-2 max-w-2xl">
                            {selectedApt.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                          <span>{selectedApt?.address}</span>
                        </span>
                        <span>•</span>
                        <span>{selectedApt?.total_floors} Floors</span>
                      </div>
                    </div>
                  </div>

                  {/* Rooms + Exact Location Map */}
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
                    {/* Rooms Grid — intentionally 2 columns for a 2 × 2 layout */}
                    <div>
                      {filteredRooms.length === 0 ? (
                        <div className="text-center py-16 bg-white border border-slate-100 rounded-xl shadow-xs">
                          <Building className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <h3 className="text-sm font-bold text-slate-700">No Rooms Available</h3>
                          <p className="text-slate-400 mt-0.5 max-w-sm mx-auto text-xs font-light">
                            No vacant rooms are currently available in this building.
                          </p>
                          <div className="flex justify-center gap-2 mt-3">
                            <button
                              onClick={() => setSelectedBuilding("all")}
                              className="px-3 py-1.5 bg-brand-orange text-white font-bold text-xs rounded-lg hover:bg-orange-600 transition-colors"
                            >
                              Browse Other Buildings
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {filteredRooms.map((room) => {
                            const roomInqCount = (db?.inquiries || []).filter((inq) => inq.room_id === room.id).length;
                            return (
                              <RoomCard
                                key={room.id}
                                room={room}
                                apt={getApartmentForRoom(room.id)}
                                inquiryCount={roomInqCount}
                                onSelect={setSelectedRoom}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Exact Apartment Location — beside the room cards */}
                    <div className="lg:sticky lg:top-24 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-orange-50 text-brand-orange">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Apartment Location</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Exact location of {selectedApt?.name || "this apartment"}
                            </p>
                          </div>
                        </div>
                      </div>
                      {selectedApt && Number.isFinite(Number(selectedApt.latitude)) && Number.isFinite(Number(selectedApt.longitude)) ? (
                        <>
                          <PropertyMap
                            points={[{
                              id: selectedApt.id,
                              name: selectedApt.name,
                              lat: Number(selectedApt.latitude),
                              lng: Number(selectedApt.longitude),
                              address: selectedApt.location_address || selectedApt.address,
                            }]}
                            height={360}
                            zoom={16}
                          />
                          <div className="px-4 py-3 border-t border-slate-100">
                            <p className="text-[11px] text-slate-600 flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0 mt-0.5" />
                              <span>{selectedApt.location_address || selectedApt.address}</span>
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="h-[360px] flex flex-col items-center justify-center text-center px-6 bg-slate-50">
                          <MapPin className="w-9 h-9 text-slate-300 mb-2" />
                          <h4 className="text-sm font-bold text-slate-600">Location Not Available</h4>
                          <p className="text-[11px] text-slate-400 mt-1">
                            The property manager has not pinned this apartment on the map yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Smooth back button */}
            <div className="mt-8 pt-4 border-t border-slate-200/60 flex justify-center">
              <button
                onClick={() => {
                  setSelectedBuilding("all");
                  document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-brand-orange text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Choose Another Apartment Building</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* About Section */}
      <section id="about" className="bg-white border-t border-b border-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">Seamless Living</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-2 mb-6">
                Why Lease with RentFlow?
              </h2>
              <p className="text-slate-600 mb-6 leading-relaxed font-light">
                We believe in simplifying the landlord-tenant connection. RentFlow features fully digitized rental payments, prompt repair notifications, direct developer messaging, and pristine buildings.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Secure Payments</h4>
                    <p className="text-xs text-slate-500 mt-1">Hassle-free digital billing statements and auto receipt records.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Instant Support</h4>
                    <p className="text-xs text-slate-500 mt-1">24/7 dedicated Facebook Messenger support to handle concerns immediately.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <img
                src={(selectedApt as any)?.image_url || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"}
                alt="Living interior"
                className="rounded-3xl shadow-xl w-full h-[400px] object-cover"
              />
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-r from-[#8B2626] to-[#EF6905] text-white p-6 rounded-2xl shadow-xl hidden sm:block border border-[#F1E5A1]/30">
                <span className="block font-black text-4xl text-[#F1E5A1]">100%</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Occupancy Satisfaction</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-[#23140e] text-white border-t border-[#8B2626]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight">Need More Information?</h2>
            <p className="text-[#ecd9c6] mt-3 font-light">
              Reach out to our main corporate leasing office or inquire directly through our online website.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#EF6905]/20 text-center">
              <Phone className="w-8 h-8 text-[#EF6905] mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Call Leasing Office</h3>
              <p className="text-[#ecd9c6] text-sm font-light">Mon-Fri from 8am to 5pm</p>
              <p className="text-[#F1E5A1] font-bold mt-4">+63 (02) 8888-9999</p>
            </div>

            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#EF6905]/20 text-center">
              <Mail className="w-8 h-8 text-[#EF6905] mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Leasing Inquiries</h3>
              <p className="text-[#ecd9c6] text-sm font-light">We reply within 24 hours</p>
              <p className="text-[#F1E5A1] font-bold mt-4">rentals@apartmentpro.ph</p>
            </div>

            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#EF6905]/20 text-center flex flex-col justify-between items-center">
              <div>
                <MessageCircle className="w-8 h-8 text-[#EF6905] mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">Inquire on Website</h3>
                <p className="text-[#ecd9c6] text-sm font-light">Select any vacant room and submit an inquiry instantly</p>
              </div>
              <a
                href="#listings"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8B2626] to-[#EF6905] hover:brightness-110 text-white font-bold text-sm rounded-xl shadow-md transition-all w-full justify-center"
              >
                <span>Browse Available Rooms</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#170d09] border-t border-[#331f16] py-12 text-[#ecd9c6] text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-[#331f16] pb-8 mb-8">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#8B2626] text-white rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <span className="font-bold text-white text-lg">Apartment<span className="text-[#EF6905]">Pro</span></span>
            </div>

            <div className="flex flex-wrap gap-6 justify-center items-center">
              <a href="#listings" className="hover:text-[#F1E5A1] transition-colors">Browse Rooms</a>
              <a href="#about" className="hover:text-[#F1E5A1] transition-colors">About</a>
              <a href="#contact" className="hover:text-[#F1E5A1] transition-colors">Contact</a>
              <a href="https://m.me/yourPageID" target="_blank" rel="noreferrer" className="hover:text-[#F1E5A1] transition-colors">FB Messenger</a>
              <a href="/admin" className="text-[#F1E5A1] hover:text-[#EF6905] text-xs font-semibold px-2.5 py-1 rounded bg-[#331f16] border border-[#EF6905]/30 transition-colors">Admin Portal</a>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} RentFlow Property Management. All rights reserved.</p>
            <p className="text-xs text-[#8c6753]">Registered Corporate Property Operator. Manila, Philippines.</p>
          </div>
        </div>
      </footer>

      {/* Room Detail Modal */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRoom(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body Container - Small & Compact Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[92vh] text-xs"
            >
              <button
                onClick={() => setSelectedRoom(null)}
                className="absolute top-2.5 right-2.5 z-30 p-1.5 bg-black/60 text-white hover:bg-brand-orange rounded-full shadow-md transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Compact Image/Status Gallery */}
              {(() => {
                const roomImagesList = selectedRoom.image_url ? selectedRoom.image_url.split(",").map(s => s.trim()).filter(Boolean) : [];
                const displayImages = roomImagesList.length > 0 ? roomImagesList : [ROOM_FALLBACK_IMAGES[selectedRoom.room_type] || ROOM_FALLBACK_IMAGES.studio];
                return (
                  <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-950 shrink-0 select-none">
                    {/* Main image container */}
                    <div 
                      className="relative h-full cursor-grab active:cursor-grabbing"
                      onTouchStart={(e) => {
                        swipeStartX.current = e.touches[0].clientX;
                      }}
                      onTouchEnd={(e) => {
                        if (swipeStartX.current === null) return;
                        const diff = swipeStartX.current - e.changedTouches[0].clientX;
                        const minSwipeDistance = 50;
                        if (diff > minSwipeDistance) {
                          setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
                        } else if (diff < -minSwipeDistance) {
                          setActiveImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                        }
                        swipeStartX.current = null;
                      }}
                      onMouseDown={(e) => {
                        swipeStartX.current = e.clientX;
                      }}
                      onMouseUp={(e) => {
                        if (swipeStartX.current === null) return;
                        const diff = swipeStartX.current - e.clientX;
                        const minSwipeDistance = 50;
                        if (diff > minSwipeDistance) {
                          setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
                        } else if (diff < -minSwipeDistance) {
                          setActiveImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                        }
                        swipeStartX.current = null;
                      }}
                    >
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={activeImageIndex}
                          src={displayImages[activeImageIndex]}
                          alt={`Room ${selectedRoom.room_number}`}
                          initial={{ opacity: 0, scale: 1.02 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.25 }}
                          className="w-full h-full object-cover absolute inset-0"
                        />
                      </AnimatePresence>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />

                      {/* Navigation Arrows if more than 1 image */}
                      {displayImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                            }}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors z-10"
                            title="Previous photo"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors z-10"
                            title="Next photo"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Photo Counter */}
                      {displayImages.length > 1 && (
                        <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold rounded font-mono z-10">
                          {activeImageIndex + 1} / {displayImages.length}
                        </span>
                      )}

                      {/* Info Overlay */}
                      <div className="absolute bottom-2.5 left-3 right-3 z-10 text-white flex justify-between items-end">
                        <div>
                          <div className="flex gap-1 mb-1">
                            <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[8px] font-bold rounded uppercase tracking-wide">
                              Available
                            </span>
                            <span className="px-1.5 py-0.2 bg-black/70 text-white text-[8px] font-mono rounded font-bold uppercase">
                              {ROOM_TYPE_LABELS[selectedRoom.room_type]}
                            </span>
                          </div>
                          <h2 className="text-base sm:text-lg font-black text-white leading-tight">Room {selectedRoom.room_number}</h2>
                          <p className="text-[10px] text-slate-300 font-medium truncate max-w-[200px]">
                            {getApartmentForRoom(selectedRoom.id)?.name}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-slate-300 block">Monthly Rent</span>
                          <span className="font-black text-base text-brand-orange">
                            ₱{Number(selectedRoom.rent_amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Scrollable Details & Inquiry Form */}
              <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 flex-1 min-h-0">
                {/* Room Spec Grid - Compact */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase font-bold">Floor Level</span>
                      <span className="font-bold text-slate-700 text-[11px]">Floor {selectedRoom.floor}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                    <div className="truncate">
                      <span className="block text-slate-400 text-[9px] uppercase font-bold">Location</span>
                      <span className="font-bold text-slate-700 text-[11px] truncate block max-w-[140px]">
                        {getApartmentForRoom(selectedRoom.id)?.address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Room Description */}
                {selectedRoom.description && (
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">Property Overview</h4>
                    <p className="text-slate-600 text-xs leading-relaxed font-light mt-0.5 line-clamp-2">
                      {selectedRoom.description}
                    </p>
                  </div>
                )}

                {/* Amenities List */}
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wide mb-1">Included Amenities</h4>
                  <div className="flex flex-wrap gap-1">
                    {(selectedRoom.amenities || "Aircon, Wifi").split(",").map((amenity, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-brand-orange border border-orange-100 text-[10px] font-bold rounded-md"
                      >
                        <Check className="w-2.5 h-2.5" />
                        <span>{amenity.trim()}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Inquiry Counter Tracker Banner */}
                {(() => {
                  const roomInqCount = (db?.inquiries || []).filter((inq) => inq.room_id === selectedRoom.id).length;
                  return (
                    <div className="p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-brand-orange shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-amber-950 block text-[11px]">
                            {roomInqCount} {roomInqCount === 1 ? "person has" : "people have"} inquired
                          </span>
                          <span className="text-[10px] text-amber-700">
                            High interest in Room {selectedRoom.room_number}. Inquire now below!
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded-md shrink-0 shadow-xs">
                        Hot Unit
                      </span>
                    </div>
                  );
                })()}

                {/* Inquiry Form & CTA */}
                <div className="border-t border-slate-100 pt-3">
                  {inquirySuccess ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2.5"
                    >
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs">Inquiry Submitted!</h4>
                        <p className="text-[11px] text-emerald-700 mt-0.5">Our property manager will review your schedule request and contact you shortly.</p>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleInquirySubmit} className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Schedule a Viewing / Inquire</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Your Full Name"
                          value={inqName}
                          onChange={(e) => setInqName(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          value={inqEmail}
                          onChange={(e) => setInqEmail(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          required
                          placeholder="Phone (0917...)"
                          value={inqPhone}
                          onChange={(e) => setInqPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                        <input
                          type="date"
                          required
                          value={inqDate}
                          onChange={(e) => setInqDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                      </div>

                      <textarea
                        rows={1}
                        placeholder="Additional notes... (optional)"
                        value={inqMessage}
                        onChange={(e) => setInqMessage(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 font-medium"
                      />

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={submittingInquiry}
                          className="w-full py-2 bg-gradient-to-r from-[#8B2626] to-[#EF6905] hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-sm active:scale-98 transition-all disabled:opacity-50"
                        >
                          {submittingInquiry ? "Submitting..." : "Submit Inquiry / Schedule Viewing"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
