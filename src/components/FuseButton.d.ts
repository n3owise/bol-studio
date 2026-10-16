import type { ComponentType, ReactNode } from 'react';
interface FuseButtonProps {
 label?: string; undoLabel?: string; doneLabel?: string; icon?: ReactNode;
 color?: string; background?: string; fuseColor?: string; size?: 'sm'|'md'|'lg';
 radius?: number; undoWindow?: number; fuse?: 'outline'|'bottom'|'top'; fuseThickness?: number;
 crossfadeMs?: number; commitOn?: 'press'|'fuseEnd'; pauseOnHover?: boolean; settle?: 'reset'|'stay';
 disabled?: boolean; onCommit?: (reason:'press'|'fuseEnd')=>void; onUndo?:()=>void;
 onFuseEnd?:()=>void; onPhaseChange?:(phase:'idle'|'armed'|'settled')=>void;
 className?:string; type?:'button'|'submit'|'reset';
}
declare const FuseButton: ComponentType<FuseButtonProps>;
export default FuseButton;
