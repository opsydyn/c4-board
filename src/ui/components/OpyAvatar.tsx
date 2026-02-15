import { RadialGradient } from "@visx/gradient";
import { Circle } from "@visx/shape";
import { useId } from "react";
import { theme } from "../../styles/theme.css";
import * as styles from "./styles.css";

interface OpyAvatarProps {
  readonly size?: number;
}

export function OpyAvatar({ size = 28 }: OpyAvatarProps) {
  const gradientId = useId();
  const center = size / 2;
  const coreRadius = size * 0.24;
  const ringRadius = coreRadius + size * 0.17;

  return (
    <span className={styles.opyAvatar} aria-hidden="true">
      <svg className={styles.opyAvatarSvg} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <RadialGradient
          id={`${gradientId}-opy-core`}
          from={theme.color.status.critical}
          fromOpacity={0.92}
          to={theme.color.background.surface}
          toOpacity={0.12}
          r={coreRadius}
          fx={center - size * 0.06}
          fy={center - size * 0.06}
        />
        <Circle
          className={styles.opyAvatarRing}
          cx={center}
          cy={center}
          r={ringRadius}
          fill="none"
          stroke={theme.color.status.critical}
          strokeOpacity={0.72}
          strokeWidth={1.2}
        />
        <Circle
          cx={center}
          cy={center}
          r={coreRadius}
          fill={`url(#${gradientId}-opy-core)`}
          stroke={theme.color.border.primary}
          strokeWidth={1.1}
        />
        <Circle
          cx={center - size * 0.06}
          cy={center - size * 0.06}
          r={coreRadius * 0.32}
          fill={theme.color.foreground.primary}
          opacity={0.28}
        />
      </svg>
    </span>
  );
}
