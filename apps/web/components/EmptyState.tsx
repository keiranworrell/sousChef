import React from "react";

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
};

type Props = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: Action[];
};

export default function EmptyState({ icon, title, description, actions }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 px-8 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950 text-3xl">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-gray-400 leading-relaxed">{description}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((action) => {
            const cls =
              action.variant === "secondary"
                ? "btn-secondary text-sm"
                : "btn-primary text-sm";
            if (action.href) {
              return (
                <a key={action.label} href={action.href} className={cls}>
                  {action.label}
                </a>
              );
            }
            return (
              <button key={action.label} type="button" onClick={action.onClick} className={cls}>
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
