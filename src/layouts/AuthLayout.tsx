import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

const bgImages = [
  "/images/auth/ERP1.jpg",
  "/images/auth/ERP2.jpg",
  "/images/auth/ERP3.jpg",
  "/images/auth/ERP4.jpg",
  "/images/auth/ERP5.jpg",
];

export default function AuthLayout() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % bgImages.length);
        setFade(true);
      }, 1200); // fade vaqti

    }, 10000); // 20 sekund

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="motion-page-shell relative min-h-screen w-full overflow-hidden">

      {/* Background */}
      <img
        src={bgImages[currentIndex]}
        alt="Auth background"
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-[15000ms] ease-linear ${fade ? "opacity-100 scale-110" : "opacity-0 scale-100"
          }`}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#14ADD6]/20 to-[#384295]/50" />

      {/* Page content */}
      <div className="relative z-10 min-h-screen w-full motion-route-shell">
        <Outlet />
      </div>
    </div>
  );
}
