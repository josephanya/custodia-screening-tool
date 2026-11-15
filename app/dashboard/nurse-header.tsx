import Image from "next/image";

import { signOutNurse } from "./actions";

export function NurseHeader() {
  return (
    <header className="nurseHeader">
      <div className="nurseHeaderBrand">
        <span className="wordmark">
          <Image alt="Custodia" className="brandLogo" height={26} src="/custodia-logo.svg" width={132} />
        </span>
        <span className="nurseHeaderDivider" aria-hidden="true" />
        <span className="nurseHeaderTitle">Diabetes dashboard</span>
      </div>
      <form action={signOutNurse}>
        <button className="secondaryButton nurseHeaderSignOut" type="submit">
          Sign out
        </button>
      </form>
    </header>
  );
}
