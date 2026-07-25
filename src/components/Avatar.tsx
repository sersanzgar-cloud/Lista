import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { findOutfit } from '../data/catalog';
import { AvatarConfig } from '../state/AppContext';

interface AvatarProps {
  avatar: AvatarConfig;
  size?: number;
  mood?: number;
}

const HEAD_CX = 100;
const HEAD_CY = 100;
const HEAD_R = 50;

function Hair({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  switch (style) {
    case 'curly':
      return (
        <G fill={color}>
          <Circle cx={62} cy={72} r={17} />
          <Circle cx={82} cy={54} r={19} />
          <Circle cx={100} cy={48} r={20} />
          <Circle cx={118} cy={54} r={19} />
          <Circle cx={138} cy={72} r={17} />
        </G>
      );
    case 'mohawk':
      return (
        <G fill={color}>
          <Path d="M50,95 A50,50 0 0 1 150,95 L150,88 A50,45 0 0 0 50,88 Z" opacity={0.25} />
          <Path d="M78,80 L85,25 L93,80 Z" />
          <Path d="M93,80 L100,15 L108,80 Z" />
          <Path d="M108,80 L115,25 L123,80 Z" />
        </G>
      );
    case 'long':
      return (
        <G fill={color}>
          <Path d="M50,95 A50,50 0 0 1 150,95 L150,70 Q100,45 50,70 Z" />
          <Path d="M48,90 Q35,150 48,195 L66,190 Q56,140 62,92 Z" />
          <Path d="M152,90 Q165,150 152,195 L134,190 Q144,140 138,92 Z" />
        </G>
      );
    case 'ponytail':
      return (
        <G fill={color}>
          <Path d="M50,95 A50,50 0 0 1 150,95 L150,70 Q100,45 50,70 Z" />
          <Ellipse cx={158} cy={112} rx={12} ry={26} transform="rotate(18 158 112)" />
        </G>
      );
    case 'short':
    default:
      return <Path d="M50,95 A50,50 0 0 1 150,95 L150,70 Q100,45 50,70 Z" fill={color} />;
  }
}

function Mouth({ mood }: { mood: number }) {
  if (mood >= 55) {
    return <Path d="M80,122 Q100,138 120,122" stroke="#5C4033" strokeWidth={3} fill="none" strokeLinecap="round" />;
  }
  if (mood >= 25) {
    return <Path d="M83,127 L117,127" stroke="#5C4033" strokeWidth={3} fill="none" strokeLinecap="round" />;
  }
  return <Path d="M80,132 Q100,118 120,132" stroke="#5C4033" strokeWidth={3} fill="none" strokeLinecap="round" />;
}

export default function Avatar({ avatar, size = 200, mood = 80 }: AvatarProps) {
  const outfit = findOutfit(avatar.outfitId);
  const outfitColor = outfit?.color ?? '#B0B0B0';

  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 200 220">
      <Path
        d="M40,220 L40,178 Q40,148 70,142 L130,142 Q160,148 160,178 L160,220 Z"
        fill={outfitColor}
      />
      <Circle cx={HEAD_CX} cy={HEAD_CY} r={HEAD_R} fill={avatar.skinTone} />

      <Ellipse cx={78} cy={100} rx={10} ry={13} fill="#FFFFFF" />
      <Ellipse cx={122} cy={100} rx={10} ry={13} fill="#FFFFFF" />
      <Circle cx={78} cy={102} r={5} fill={avatar.eyeColor} />
      <Circle cx={122} cy={102} r={5} fill={avatar.eyeColor} />

      <Rect x={68} y={82} width={20} height={4} rx={2} fill={avatar.hairColor} opacity={0.8} />
      <Rect x={112} y={82} width={20} height={4} rx={2} fill={avatar.hairColor} opacity={0.8} />

      <Mouth mood={mood} />

      <Hair style={avatar.hairStyle} color={avatar.hairColor} />
    </Svg>
  );
}
