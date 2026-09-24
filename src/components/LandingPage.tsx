import React, { useState, useEffect, useRef } from "react";
import { Apartment, Room, Inquiry } from "../types";
import { api, DBState } from "../lib/api";
import { Building, MapPin, Search, Eye, MessageCircle, Star, Phone, Mail, Clock, Calendar, Check, X, Shield, ArrowRight, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  onSelect: (room: Room) => void;
  key?: string | number;
}

function RoomCard({ room, apt, onSelect }: RoomCardProps) {
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-md hover:shadow-xl transition-all flex flex-col group"
    >
      {/* Card Image Area with Carousel */}
      <div 
        className="relative aspect-[4/3] overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing select-none"
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
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        
        {/* Navigation Arrows */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 duration-300 shadow-sm z-10"
              title="Previous Photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 duration-300 shadow-sm z-10"
              title="Next Photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dots Indicator Overlay */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 py-1 px-2 rounded-full bg-black/30 backdrop-blur-sm">
            {displayImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "bg-brand-orange w-3" : "bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        )}

        {/* Status/New Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
          <span className="px-2.5 py-1 bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-sm">
            Available
          </span>
          {room.is_newly_available && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-lg shadow-sm">
              <Star className="w-3 h-3 fill-current" /> New
            </span>
          )}
        </div>

        {/* Room Type Pill */}
        <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold rounded-lg uppercase tracking-wider pointer-events-none">
          {ROOM_TYPE_LABELS[room.room_type]}
        </span>
      </div>

      {/* Card Content */}
      <div className="p-6 flex-grow flex flex-col justify-between">
        <div>
          {/* Price Section */}
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-xl font-extrabold text-slate-900">Room {room.room_number}</h3>
            <div className="text-brand-orange font-extrabold text-2xl">
              ₱{Number(room.rent_amount).toLocaleString()}<span className="text-xs text-slate-400 font-medium">/mo</span>
            </div>
          </div>

          {/* Building Name and Floor */}
          <div className="flex items-center gap-1.5 text-slate-600 text-sm font-semibold mb-1">
            <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{apt?.name || "ApartmentPro Complex"}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Floor {room.floor}</span>
          </div>

          {/* Address */}
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-4">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{apt?.address || "Address Not Available"}</span>
          </div>

          {/* Description Clamp */}
          <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed font-light">
            {room.description}
          </p>
        </div>

        <div>
          {/* Amenities Pills */}
          <div className="flex flex-wrap gap-1 mb-5">
            {(room.amenities || "Aircon, Wifi").split(",").map((amenity, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md border border-slate-200/50"
              >
                {amenity.trim()}
              </span>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={() => onSelect(room)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white font-bold text-sm rounded-xl shadow-md shadow-[#e73f1e]/20 transition-all active:scale-[0.98]"
          >
            <Eye className="w-4 h-4 text-white" />
            <span>View Details & Inquire</span>
          </button>
        </div>
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

  const activeApartments = db?.apartments.filter((apt) => apt.status === "active") || [];

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
        apartment_name: apt?.name || "ApartmentPro Complex",
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
              <div className="p-2 bg-[#e73f1e] text-white rounded-xl shadow-md">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight text-[#2c1a11]">
                  Apartment<span className="text-[#fb6c00]">Pro</span>
                </span>
                <span className="block text-[9px] text-[#8c6753] font-mono tracking-wider -mt-1 font-semibold">PROPERTY PLATFORM</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#listings" className="text-[#44281d] hover:text-[#fb6c00] font-medium transition-colors">Browse Rooms</a>
              <a href="#about" className="text-[#44281d] hover:text-[#fb6c00] font-medium transition-colors">About</a>
              <a href="#contact" className="text-[#44281d] hover:text-[#fb6c00] font-medium transition-colors">Contact</a>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="#listings"
                className="flex items-center gap-2 px-4 py-2 bg-[#fb6c00] hover:bg-[#e73f1e] text-white font-medium text-sm rounded-xl shadow-md active:scale-95 transition-all"
              >
                <span>Inquire Online</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-[#23140e] text-white py-24 sm:py-32 overflow-hidden border-b border-[#e73f1e]/30">
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fb6c00]/20 text-[#f9b637] border border-[#fb6c00]/40 rounded-full text-xs font-semibold tracking-wider uppercase mb-6">
              <Star className="w-3.5 h-3.5 fill-current" /> Premium Rental Properties
            </span>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
              Find Your Next Home in <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e73f1e] via-[#fb6c00] to-[#f9b637]">
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
              <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700">No Buildings Found</h3>
                <p className="text-slate-400 mt-1 max-w-md mx-auto">There are no active apartment buildings listed at the moment. Please contact the office or check back later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredApartments.map((apt, idx) => {
                  const vacantCount = getVacantRoomCount(apt.id);
                  const displayImage = APARTMENT_FALLBACK_IMAGES[idx % APARTMENT_FALLBACK_IMAGES.length];
                  return (
                    <motion.div
                      key={apt.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      onClick={() => {
                        setSelectedBuilding(apt.id);
                        // Smooth scroll to listings container top
                        document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-md hover:shadow-xl transition-all flex flex-col cursor-pointer group"
                    >
                      {/* Apartment Image Area */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                        <img
                          src={displayImage}
                          alt={apt.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        
                        {/* Vacant badge */}
                        <span className={`absolute top-3 right-3 px-2.5 py-1 text-[11px] font-bold rounded-lg shadow-sm ${
                          vacantCount > 0 ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                        }`}>
                          {vacantCount > 0 ? `${vacantCount} Available Room${vacantCount > 1 ? "s" : ""}` : "Fully Occupied"}
                        </span>
                      </div>

                      {/* Apartment Card Content */}
                      <div className="p-6 flex-grow flex flex-col justify-between">
                        <div>
                          <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-brand-orange transition-colors mb-2">
                            {apt.name}
                          </h3>
                          
                          {/* Address */}
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-3">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{apt.address}</span>
                          </div>

                          <p className="text-slate-600 text-sm font-light line-clamp-2 mb-4 leading-relaxed">
                            {apt.description}
                          </p>
                        </div>

                        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">{apt.total_floors} Floors</span>
                          <span className="text-brand-orange font-bold text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            View Rooms <ArrowRight className="w-4 h-4" />
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
            {/* Elegant Apartment Detail Hero Card */}
            {(() => {
              const selectedApt = db?.apartments.find((a) => a.id === selectedBuilding);
              return (
                <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 mb-10 relative overflow-hidden shadow-lg">
                  {/* Subtle building image overlay background */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <img
                      src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
                      alt="Apartment overlay"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedBuilding("all")}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-orange uppercase tracking-wider hover:text-orange-400 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/5"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back to Buildings
                      </button>
                      
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{selectedApt?.name}</h2>
                        {selectedApt?.description && (
                          <p className="text-slate-300 font-light text-sm max-w-3xl mt-1.5 leading-relaxed">
                            {selectedApt.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-semibold pt-1">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                          <span>{selectedApt?.address}</span>
                        </span>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <span>{selectedApt?.total_floors} Floors Available</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 bg-white/5 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 lg:gap-1.5 min-w-[150px]">
                      <div>
                        <span className="block text-[10px] uppercase font-black tracking-widest text-orange-400 text-left lg:text-center">Available Units</span>
                        <span className="text-3xl font-black text-white">{filteredRooms.length}</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        Vacant
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10">
              <div>
                <span className="text-xs font-extrabold text-brand-orange uppercase tracking-widest">Step 2: Choose Your Room</span>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Available Rooms in Building</h3>
                <p className="text-slate-500 mt-1">Ready for immediate occupancy. Select a room to view details and submit an inquiry.</p>
              </div>
              <div className="px-4 py-2 bg-slate-100 rounded-xl text-slate-700 font-semibold text-sm">
                {filteredRooms.length} {filteredRooms.length === 1 ? "room found" : "rooms found"}
              </div>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700">No Rooms Available</h3>
                <p className="text-slate-400 mt-1 max-w-sm mx-auto text-sm font-light">
                  No vacant rooms are currently available in this building.
                </p>
                <div className="flex justify-center gap-3 mt-6">
                  <button
                    onClick={() => setSelectedBuilding("all")}
                    className="px-5 py-2 bg-brand-orange text-white font-bold text-xs rounded-xl hover:bg-orange-600 transition-colors"
                  >
                    Browse Other Buildings
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    apt={getApartmentForRoom(room.id)}
                    onSelect={setSelectedRoom}
                  />
                ))}
              </div>
            )}
            
            {/* Smooth back button */}
            <div className="mt-12 pt-8 border-t border-slate-200/60 flex justify-center">
              <button
                onClick={() => {
                  setSelectedBuilding("all");
                  document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-brand-orange text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                <ChevronLeft className="w-4 h-4" />
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
                Why Lease with ApartmentPro?
              </h2>
              <p className="text-slate-600 mb-6 leading-relaxed font-light">
                We believe in simplifying the landlord-tenant connection. ApartmentPro features fully digitized rental payments, prompt repair notifications, direct developer messaging, and pristine buildings.
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
                src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
                alt="Living interior"
                className="rounded-3xl shadow-xl w-full h-[400px] object-cover"
              />
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] text-white p-6 rounded-2xl shadow-xl hidden sm:block border border-[#ffdd9c]/30">
                <span className="block font-black text-4xl text-[#ffdd9c]">100%</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Occupancy Satisfaction</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-[#23140e] text-white border-t border-[#e73f1e]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight">Need More Information?</h2>
            <p className="text-[#ecd9c6] mt-3 font-light">
              Reach out to our main corporate leasing office or inquire directly through our online website.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#fb6c00]/20 text-center">
              <Phone className="w-8 h-8 text-[#fb6c00] mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Call Leasing Office</h3>
              <p className="text-[#ecd9c6] text-sm font-light">Mon-Fri from 8am to 5pm</p>
              <p className="text-[#f9b637] font-bold mt-4">+63 (02) 8888-9999</p>
            </div>

            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#fb6c00]/20 text-center">
              <Mail className="w-8 h-8 text-[#fb6c00] mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Leasing Inquiries</h3>
              <p className="text-[#ecd9c6] text-sm font-light">We reply within 24 hours</p>
              <p className="text-[#f9b637] font-bold mt-4">rentals@apartmentpro.ph</p>
            </div>

            <div className="bg-[#331f16] p-8 rounded-2xl border border-[#fb6c00]/20 text-center flex flex-col justify-between items-center">
              <div>
                <MessageCircle className="w-8 h-8 text-[#fb6c00] mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">Inquire on Website</h3>
                <p className="text-[#ecd9c6] text-sm font-light">Select any vacant room and submit an inquiry instantly</p>
              </div>
              <a
                href="#listings"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:brightness-110 text-white font-bold text-sm rounded-xl shadow-md transition-all w-full justify-center"
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
              <div className="p-1.5 bg-[#e73f1e] text-white rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <span className="font-bold text-white text-lg">Apartment<span className="text-[#fb6c00]">Pro</span></span>
            </div>

            <div className="flex flex-wrap gap-6 justify-center items-center">
              <a href="#listings" className="hover:text-[#f9b637] transition-colors">Browse Rooms</a>
              <a href="#about" className="hover:text-[#f9b637] transition-colors">About</a>
              <a href="#contact" className="hover:text-[#f9b637] transition-colors">Contact</a>
              <a href="https://m.me/yourPageID" target="_blank" rel="noreferrer" className="hover:text-[#f9b637] transition-colors">FB Messenger</a>
              <a href="/admin" className="text-[#ffdd9c] hover:text-[#fb6c00] text-xs font-semibold px-2.5 py-1 rounded bg-[#331f16] border border-[#fb6c00]/30 transition-colors">Admin Portal</a>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} ApartmentPro Property Management. All rights reserved.</p>
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

            {/* Modal Body Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white w-full max-w-5xl rounded-2xl shadow-2xl z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-2 max-h-[90vh]"
            >
              <button
                onClick={() => setSelectedRoom(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/60 text-white hover:bg-brand-orange rounded-full shadow-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Left Column: Image/Status Gallery */}
              {(() => {
                const roomImagesList = selectedRoom.image_url ? selectedRoom.image_url.split(",").map(s => s.trim()).filter(Boolean) : [];
                const displayImages = roomImagesList.length > 0 ? roomImagesList : [ROOM_FALLBACK_IMAGES[selectedRoom.room_type] || ROOM_FALLBACK_IMAGES.studio];
                return (
                  <div className="relative h-[320px] lg:h-full overflow-hidden bg-slate-950 flex flex-col justify-between">
                    {/* Main image container */}
                    <div 
                      className="relative flex-1 overflow-hidden h-full cursor-grab active:cursor-grabbing select-none"
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
                          transition={{ duration: 0.3 }}
                          className="w-full h-full object-cover absolute inset-0"
                        />
                      </AnimatePresence>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />

                      {/* Navigation Arrows if more than 1 image */}
                      {displayImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors z-10"
                            title="Previous photo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors z-10"
                            title="Next photo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}

                      {/* Photo Counter */}
                      {displayImages.length > 1 && (
                        <span className="absolute top-4 left-4 px-2 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold rounded-lg font-mono z-10">
                          {activeImageIndex + 1} / {displayImages.length}
                        </span>
                      )}

                      {/* Thumbnails Overlay Row */}
                      {displayImages.length > 1 && (
                        <div className="absolute bottom-24 left-6 right-6 flex gap-2 overflow-x-auto pb-1 z-10 no-scrollbar">
                          {displayImages.map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveImageIndex(idx)}
                              className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                                idx === activeImageIndex ? "border-brand-orange scale-105 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                              }`}
                            >
                              <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Info Overlay */}
                    <div className="absolute bottom-6 left-6 z-10 text-white">
                      <div className="flex gap-1.5 mb-2">
                        <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide">
                          Available Room
                        </span>
                        {selectedRoom.is_newly_available && (
                          <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide">
                            Newly Listed
                          </span>
                        )}
                      </div>
                      <h2 className="text-3xl font-black">Room {selectedRoom.room_number}</h2>
                      <p className="text-slate-300 font-semibold">{getApartmentForRoom(selectedRoom.id)?.name}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Right Column: Full Details & Inquiry Forms */}
              <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-100px)] lg:max-h-[90vh] flex flex-col justify-between">
                <div>
                  {/* Price Banner */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <span className="text-slate-400 text-xs uppercase tracking-wider font-bold">Monthly Rent</span>
                      <div className="text-brand-orange font-black text-3xl">
                        ₱{Number(selectedRoom.rent_amount).toLocaleString()}
                        <span className="text-sm font-light text-slate-400">/month</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-xs uppercase tracking-wider font-bold">Type</span>
                      <div className="text-slate-800 font-black text-lg">
                        {ROOM_TYPE_LABELS[selectedRoom.room_type]}
                      </div>
                    </div>
                  </div>

                  {/* Room Spec Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                      <Building className="w-5 h-5 text-brand-orange" />
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-bold">Location</span>
                        <span className="font-bold text-slate-700">Floor {selectedRoom.floor}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-brand-orange" />
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-bold">Address</span>
                        <span className="font-bold text-slate-700 truncate max-w-[130px] block">
                          {getApartmentForRoom(selectedRoom.id)?.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Room Description */}
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">Property Overview</h4>
                    <p className="text-slate-600 text-sm leading-relaxed font-light">
                      {selectedRoom.description}
                    </p>
                  </div>

                  {/* Amenities List */}
                  <div className="mb-8">
                    <h4 className="font-bold text-slate-800 mb-2.5 text-sm uppercase tracking-wide">Included Amenities</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedRoom.amenities || "Aircon, Wifi").split(",").map((amenity, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 px-3 py-1 bg-orange-50 text-brand-orange border border-orange-100 text-xs font-bold rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{amenity.trim()}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Inquiry Form & CTA */}
                <div className="border-t border-slate-100 pt-6">
                  {inquirySuccess ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3"
                    >
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold">Inquiry Submitted Successfully!</h4>
                        <p className="text-xs text-emerald-700 mt-1">Our property manager will review your schedule request and contact you shortly. Thank you!</p>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleInquirySubmit} className="space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Schedule a Viewing / Inquire</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Your Full Name"
                          value={inqName}
                          onChange={(e) => setInqName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          value={inqEmail}
                          onChange={(e) => setInqEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="tel"
                          required
                          placeholder="Phone Number (e.g., 0917...)"
                          value={inqPhone}
                          onChange={(e) => setInqPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                        <input
                          type="date"
                          required
                          value={inqDate}
                          onChange={(e) => setInqDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-slate-800 font-medium"
                        />
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Additional notes or questions... (optional)"
                        value={inqMessage}
                        onChange={(e) => setInqMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-slate-800 font-medium"
                      />

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={submittingInquiry}
                          className="w-full px-5 py-3 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white font-extrabold text-sm rounded-xl shadow-md shadow-[#e73f1e]/25 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {submittingInquiry ? "Submitting Inquiry..." : "Submit Inquiry / Schedule Viewing"}
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
