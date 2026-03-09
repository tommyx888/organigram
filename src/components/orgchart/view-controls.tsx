"use client";

import { useTranslation } from "@/lib/i18n/context";

type ViewControlsProps = {
  showEmployeeId: boolean;
  showDepartment: boolean;
  selectedDepartment: string;
  departments: string[];
  onShowEmployeeIdChange: (value: boolean) => void;
  onShowDepartmentChange: (value: boolean) => void;
  onDepartmentChange: (value: string) => void;
};

export function ViewControls(props: ViewControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">{t("orgChart.displayControls")}</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.showEmployeeId}
            onChange={(event) => props.onShowEmployeeIdChange(event.target.checked)}
          />
          {t("orgChart.showEmployeeNumber")}
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.showDepartment}
            onChange={(event) => props.onShowDepartmentChange(event.target.checked)}
          />
          {t("orgChart.showDepartment")}
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t("orgChart.department")}
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={props.selectedDepartment}
            onChange={(event) => props.onDepartmentChange(event.target.value)}
          >
            <option value="all">{t("orgChart.departmentAll")}</option>
            {props.departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
