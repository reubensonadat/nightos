import { ShoppingBagIcon, Squares2X2Icon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";

type Tab = 'menu' | 'cart' | 'orders';

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  cartCount: number;
};

const TABS: { id: Tab; label: string; icon: typeof Squares2X2Icon }[] = [
  { id: 'menu', label: 'Menu', icon: Squares2X2Icon },
  { id: 'cart', label: 'Cart', icon: ShoppingBagIcon },
  { id: 'orders', label: 'Orders', icon: ClipboardDocumentListIcon },
];

export function CustomerBottomNav({ activeTab, onTabChange, cartCount }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-licorice/8 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                isActive ? 'text-licorice' : 'text-feldgrau/60 hover:text-feldgrau'
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.75} />
                {id === 'cart' && cartCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-dark-red px-1 text-[8px] font-bold leading-none text-white shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
