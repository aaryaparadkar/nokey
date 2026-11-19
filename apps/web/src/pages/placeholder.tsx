import type { ReactNode } from "react";
import {
  Frame,
  FrameBody,
  FrameDescription,
  FrameHeader,
  FrameTitle,
} from "@/components/sodium/ui/frame";

export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="type-title">{title}</h1>
      <Frame>
        <FrameHeader>
          <FrameTitle>{title}</FrameTitle>
        </FrameHeader>
        <FrameBody>
          <FrameDescription>Coming soon.</FrameDescription>
          {children}
        </FrameBody>
      </Frame>
    </div>
  );
}
