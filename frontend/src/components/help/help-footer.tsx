export function HelpFooter() {
  return (
    <footer className="mt-16 border-t border-[#f0e6ec] bg-white">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-1 px-5 py-8 text-center">
        <div className="sb-script text-2xl text-foreground">Superbae</div>
        <p className="text-[13px] text-muted-foreground">Support. Guidance. Solutions. — We&rsquo;re with you every step.</p>
        <p className="mt-2 text-xs text-[#a0a0a0]">© {new Date().getFullYear()} Superbae Help Center</p>
      </div>
    </footer>
  );
}
