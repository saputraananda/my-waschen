// ─────────────────────────────────────────────────────────────────────────────
// ProfileAvatar.jsx — Reusable Gender-Aware Profile Avatar
// Uses actual character avatars based on gender and role type
//
// Assets:
// - Customer Male:   Avatar set/customer-male-1.webp
// - Customer Female: Avatar set/customer-girl.webp
// - Staff Male:       Avatar set/staff-boy.webp
// - Staff Female:    Avatar set/staff-girl.webp
// - Admin:           Avatar set/admin-laptop.webp (fixed)
// - Delivery:        Avatar set/staff-boy-thumbs-up.webp (fixed)
//
// Usage:
//   <ProfileAvatar user={user} size={40} />
//   <ProfileAvatar name="Budi" gender="male" role="staff" size={36} />
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getAvatarSource } from '../../utils/avatar';

// Avatar fallback (gender-aware character avatar when no photo)
function GenderedFallback({ name, gender, role, size, style }) {
  const initials = (name || 'US')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const fallbackSrc = getAvatarSource({ name, gender, roleCode: role });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: size / 2,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={fallbackSrc}
        alt={initials}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      {/* Final fallback to initials if image also fails */}
      <div
        style={{
          display: 'none',
          position: 'absolute',
          inset: 0,
          borderRadius: size / 2,
          background: 'linear-gradient(135deg, #AD80AF 0%, #5B005F 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Poppins', sans-serif",
          fontSize: size * 0.35,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {initials}
      </div>
    </div>
  );
}

/**
 * ProfileAvatar — Displays user avatar with gender-aware character images
 *
 * @param {object} user - User object with photo, name, gender, roleCode properties
 * @param {number} size - Avatar size in pixels (default: 40)
 * @param {boolean} showBorder - Show white border ring (default: true)
 * @param {boolean} clickable - Enable hover/tap animations (default: false)
 * @param {boolean} notificationDot - Show notification dot (default: false)
 * @param {object} style - Additional inline styles
 * @param {string} className - Additional CSS class
 * @param {string} onClick - Click handler
 */
function ProfileAvatar({
  user,
  size = 40,
  showBorder = true,
  clickable = false,
  notificationDot = false,
  style = {},
  className = '',
  onClick,
}) {
  const avatarSrc = useMemo(() => {
    if (user) return getAvatarSource(user);
    return null;
  }, [user]);

  const avatarName = user?.name;
  const avatarGender = user?.gender;
  const avatarRole = user?.roleCode || user?.originalRoleCode || user?.role;
  const borderSize = Math.max(1, size * 0.05);

  const Wrapper = clickable ? motion.div : 'div';
  const wrapperProps = clickable
    ? {
        whileHover: { scale: 1.08 },
        whileTap: { scale: 0.94 },
        transition: { type: 'spring', stiffness: 400, damping: 20 },
      }
    : {};

  return (
    <Wrapper
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        ...wrapperProps,
        ...style,
      }}
    >
      {/* Avatar Image */}
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={avatarName || 'Profile'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: size / 2,
            objectFit: 'cover',
            border: showBorder ? `${borderSize}px solid rgba(255,255,255,0.5)` : 'none',
            boxShadow: '2px 2px 8px rgba(91,0,95,0.15), -1px -1px 4px rgba(255,255,255,0.5)',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}

      {/* Fallback avatar (shown if no photo uploaded) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: avatarSrc ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size / 2,
          border: showBorder ? `${borderSize}px solid rgba(255,255,255,0.5)` : 'none',
          boxShadow: '2px 2px 8px rgba(91,0,95,0.15), -1px -1px 4px rgba(255,255,255,0.5)',
          overflow: 'hidden',
        }}
      >
        <GenderedFallback name={avatarName} gender={avatarGender} role={avatarRole} size={size} />
      </div>

      {/* Notification Dot */}
      {notificationDot && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: Math.max(8, size * 0.22),
            height: Math.max(8, size * 0.22),
            borderRadius: '50%',
            background: '#F93E11',
            border: `${borderSize}px solid white`,
            zIndex: 1,
          }}
        />
      )}
    </Wrapper>
  );
}

/**
 * ProfileAvatarButton — Avatar styled as a clickable button
 */
function ProfileAvatarButton({ user, size = 40, notificationDot = false, onClick, style = {} }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: size / 2,
        ...style,
      }}
    >
      <ProfileAvatar
        user={user}
        size={size}
        showBorder={true}
        notificationDot={notificationDot}
      />
    </motion.button>
  );
}

/**
 * CompactProfileAvatar — Smaller avatar with role badge
 */
function CompactProfileAvatar({ user, size = 36, showBadge = false }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <ProfileAvatar user={user} size={size} />

      {showBadge && (
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: Math.max(10, size * 0.3),
            height: Math.max(10, size * 0.3),
            borderRadius: '50%',
            background: '#059669',
            border: '1.5px solid white',
          }}
        />
      )}
    </div>
  );
}

/**
 * AvatarGroup — Stack of overlapping avatars
 */
function AvatarGroup({ users = [], size = 36, overlap = 0.3, max = 4, moreLabel = '+' }) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((user, i) => (
        <div
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -(size * overlap),
            zIndex: visible.length - i,
            border: '2px solid white',
            borderRadius: size / 2,
          }}
        >
          <ProfileAvatar user={user} size={size} showBorder={false} />
        </div>
      ))}

      {overflow > 0 && (
        <div
          style={{
            marginLeft: -(size * overlap),
            width: size,
            height: size,
            borderRadius: size / 2,
            background: '#AD80AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif",
            fontSize: size * 0.3,
            fontWeight: 700,
            color: '#fff',
            border: '2px solid white',
            zIndex: 0,
          }}
        >
          {moreLabel}{overflow}
        </div>
      )}
    </div>
  );
}

// Named exports for compatibility with named imports
export default ProfileAvatar;
export { ProfileAvatar, ProfileAvatarButton, CompactProfileAvatar, AvatarGroup };
