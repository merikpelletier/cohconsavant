// Updated: MessageCircle for Salons
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Clapperboard, MessageCircle, BookOpen, Settings, User, UsersRound, Wand2, Handshake, Gamepad2, Store } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';

const NAV_DEFAULTS = [
  { key: 'nav_magazine', name: 'Magazine', page: 'Index', icon: Clapperboard },
  { key: 'nav_salons', name: 'Salons', page: 'Salons', icon: MessageCircle },
  { key: 'nav_plus', name: 'Plus', page: 'Plus', icon: BookOpen },
];

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const [cartCount, setCartCount] = useState(0);
  const [navItems, setNavItems] = useState(NAV_DEFAULTS);
  const { user, isLoadingAuth } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    const checkMembership = async () => {
      if (!user?.email) return;
      if (isAdmin) {
        setIsMember(true);
        return;
      }
      try {
        const memberships = await appClient.entities.Membership.filter({ user_email: user.email });
        setIsMember(memberships.length > 0);
      } catch {
        setIsMember(false);
      }
    };
    checkMembership();
  }, [user?.email, isAdmin]);

  useEffect(() => {
    const updateCartCount = () => {
      const cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]');
      const total = cart.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(total);
    };
    updateCartCount();
    const interval = setInterval(updateCartCount, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    appClient.functions.invoke('manageAppLabel', { action: 'list' }).then(r => r.data.items).then((labels) => {
      const map = {};
      labels.forEach(l => { map[l.key] = l.value; });
      setNavItems(NAV_DEFAULTS.map(item => ({
        ...item,
        name: map[item.key] ?? item.name,
      })));
    }).catch(() => {});
  }, []);

  return (
    <nav className="bottom-nav-safe fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10 shadow-lg">
      <div className="flex items-center h-14 md:h-16 w-full">

        {/* All nav icons evenly distributed */}
        {navItems.map((item) => {
          const pageUrl = createPageUrl(item.page);
          const isActive = currentPath === pageUrl || currentPath === `/${item.page}`;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.page}
              to={pageUrl}
              className="relative flex-1 flex flex-col items-center justify-center h-14 md:h-16 gap-0.5"
            >
              <IconComponent
                size={20}
                className={`transition-colors ${isActive ? 'text-red-500' : 'text-white/60 hover:text-white'}`}
              />
              <span className={`text-xs hidden md:block tracking-widest transition-colors ${isActive ? 'text-red-500 font-semibold' : 'text-white/70 font-medium'}`}>
                {item.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}

        {/* Studio */}
        <Link to="/Studio" className="relative flex-1 flex flex-col items-center justify-center h-14 md:h-16 gap-0.5">
          <Wand2 size={20} className={`${currentPath === '/Studio' ? 'text-white' : 'text-white/60'} hover:text-white transition-colors`} />
          {currentPath === '/Studio' && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          )}
        </Link>

        {/* Game Universe */}
        <Link to="/GameThemes" className="relative flex-1 flex flex-col items-center justify-center h-14 md:h-16 gap-0.5">
          <Gamepad2 size={20} className={`${currentPath === '/GameThemes' || currentPath.startsWith('/GamePlayer') || currentPath.startsWith('/GameVisit') ? 'text-red-500' : 'text-white/60'} hover:text-white transition-colors`} />
          {currentPath === '/GameThemes' && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          )}
        </Link>

        {/* Members Listing */}
        <Link to="/MemberListing" className="relative flex-1 flex items-center justify-center h-14 md:h-16">
          <UsersRound size={20} className={`${currentPath === '/MemberListing' ? 'text-white' : 'text-white/60'} hover:text-white transition-colors`} />
          {currentPath === '/MemberListing' && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          )}
        </Link>

        {/* Sponsor */}
        <Link to="/SponsorRequest" className="relative flex-1 flex items-center justify-center h-14 md:h-16">
          <Handshake size={20} className={`${currentPath === '/SponsorRequest' ? 'text-white' : 'text-white/60'} hover:text-white transition-colors`} />
          {currentPath === '/SponsorRequest' && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          )}
        </Link>

        {/* Profile / Log In */}
        {user ? (
          <Link to="/MemberDashboard" className="relative flex-1 flex flex-col items-center justify-center h-14 md:h-16 gap-0.5">
            <User size={20} className={`${currentPath === '/MemberDashboard' ? 'text-white' : 'text-white/60'} hover:text-white transition-colors`} />
            {currentPath === '/MemberDashboard' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            )}
          </Link>
        ) : (
          <Link to="/Connexion" className="relative flex-shrink-0 flex flex-col items-center justify-center h-14 md:h-16 px-3">
            <span className="bg-red-600 text-white text-[11px] font-black tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap">CONNEXION</span>
          </Link>
        )}


        {/* Admin (if admin) */}
        {isAdmin && (
          <Link to="/Admin" className="relative flex-1 flex items-center justify-center h-14 md:h-16">
            <Settings size={20} className={`${currentPath === '/Admin' ? 'text-white' : 'text-white/60'} hover:text-white transition-colors`} />
            {currentPath === '/Admin' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            )}
          </Link>
        )}

        {/* Boutique / Cart */}
        <Link to={createPageUrl('Boutique')} className="relative flex-1 flex flex-col items-center justify-center h-14 md:h-16 gap-0.5">
          <div className="relative">
            <Store size={20} className={`${currentPath === createPageUrl('Boutique') ? 'text-red-500' : 'text-white/60'} hover:text-white transition-colors`} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {cartCount}
              </span>
            )}
          </div>
          {currentPath === createPageUrl('Boutique') && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-600 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          )}
        </Link>

      </div>
    </nav>
  );
}
