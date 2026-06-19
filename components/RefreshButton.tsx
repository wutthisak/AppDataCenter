"use client";

import React from "react";

type Props = React.PropsWithChildren<{
  href?: string;
  className?: string;
}>;

export default function RefreshButton({ href, className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        // Perform a full reload like pressing F5
        if (href && window.location.pathname !== new URL(href, window.location.origin).pathname) {
          // If href points to a different pathname, navigate there then reload
          window.location.href = href;
        } else {
          window.location.reload();
        }
      }}
    >
      {children}
    </button>
  );
}
