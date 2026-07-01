"use client";

import { useEffect } from "react";

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

function isHTMLElement(value: Element | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isVisibleModal(element: HTMLElement) {
  if (!element.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getTopModal() {
  const modals = Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)).filter(isVisibleModal);
  return modals[modals.length - 1] ?? null;
}

function getModalSurface(modal: HTMLElement) {
  const style = window.getComputedStyle(modal);
  const rect = modal.getBoundingClientRect();
  const looksLikeBackdrop =
    (style.position === "fixed" || style.position === "absolute") &&
    rect.width >= window.innerWidth * 0.7 &&
    rect.height >= window.innerHeight * 0.7;

  if (!looksLikeBackdrop) return modal;

  const firstChild = Array.from(modal.children).find(isHTMLElement);
  return firstChild ?? modal;
}

function focusModal(surface: HTMLElement) {
  if (document.activeElement instanceof HTMLElement && surface.contains(document.activeElement)) {
    return;
  }

  if (!surface.hasAttribute("tabindex")) {
    surface.setAttribute("tabindex", "-1");
    surface.setAttribute("data-auto-modal-tabindex", "true");
  }

  surface.focus({ preventScroll: true });
}

export function ModalAutoScroller() {
  useEffect(() => {
    let activeModal: HTMLElement | null = null;
    let previousBodyOverflow: string | null = null;
    let frame = 0;

    const restoreBodyScroll = () => {
      if (previousBodyOverflow === null) return;
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = null;
    };

    const lockBodyScroll = () => {
      if (previousBodyOverflow === null) {
        previousBodyOverflow = document.body.style.overflow;
      }
      if (document.body.style.overflow !== "hidden") {
        document.body.style.overflow = "hidden";
      }
    };

    const syncModal = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const modal = getTopModal();

        if (!modal) {
          activeModal = null;
          restoreBodyScroll();
          return;
        }

        if (modal !== activeModal) {
          activeModal = modal;
          const surface = getModalSurface(modal);
          const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          surface.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest"
          });
          focusModal(surface);
        }

        lockBodyScroll();
      });
    };

    const observer = new MutationObserver(syncModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "class", "hidden", "role", "style"]
    });

    syncModal();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      restoreBodyScroll();
    };
  }, []);

  return null;
}
