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

// Avatar fallback (circular initials for when no user data)
function InitialsFallback({ name, size, style }) {
  const initials = (name || 'US')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: 'linear-gradient(135deg, #AD80AF 0%, #5B005F 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif",
        fontSize: size * 0.35,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        ...style,
      }}
    >
      {initials}
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
export default function ProfileAvatar({
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
            // Fallback to initials on image error
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}

      {/* Fallback initials (shown if no avatar image) */}
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
        }}
      >
        <InitialsFallback name={avatarName} size={size} />
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
 *
 * @param {object} user - User object
 * @param {number} size - Avatar size (default: 40)
 * @param {boolean} notificationDot - Show notification dot
 * @param {function} onClick - Click handler
 * @param {object} style - Additional styles
 */
export function ProfileAvatarButton({ user, size = 40, notificationDot = false, onClick, style = {} }) {
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
 *
 * @param {object} user - User object
 * @param {number} size - Avatar size (default: 36)
 * @param {boolean} showBadge - Show role badge (default: false)
 */
export function CompactProfileAvatar({ user, size = 36, showBadge = false }) {
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
 *
 * @param {array} users - Array of user objects
 * @param {number} size - Each avatar size (default: 36)
 * @param {number} overlap - Overlap percentage (default: 0.3 = 30%)
 * @param {number} max - Maximum visible avatars (default: 4)
 * @param {string} moreLabel - Label for overflow count
 */
export function AvatarGroup({ users = [], size = 36, overlap = 0.3, max = 4, moreLabel = '+' }) {
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
