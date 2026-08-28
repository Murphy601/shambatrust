import {
  JOINT_TENANCY_ALERT_EN,
  JOINT_TENANCY_ALERT_SW,
} from "@/lib/legal/ownership";

export function JointTenancyAlert({ locale }: { locale: "en" | "sw" }) {
  return (
    <p
      role="alert"
      className="rounded-[0.35rem] border-2 border-brass bg-[#fff8e8] px-3 py-3 text-base text-ink"
    >
      {locale === "sw" ? JOINT_TENANCY_ALERT_SW : JOINT_TENANCY_ALERT_EN}
    </p>
  );
}
