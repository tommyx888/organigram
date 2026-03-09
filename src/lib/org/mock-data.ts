import type { EmployeeRecord } from "@/lib/org/types";

export const defaultEmployeeRecords: EmployeeRecord[] = [
  {
    employeeId: "1001",
    fullName: "Eva Novak",
    department: "Executive",
    positionType: "salaried",
    positionName: "Chief Executive Officer",
    managerEmployeeId: null,
    kat: "SAL",
  },
  {
    employeeId: "1201",
    fullName: "Peter Urban",
    department: "Production",
    positionType: "direct",
    positionName: "Production Manager",
    managerEmployeeId: "1001",
    kat: "INDIR2",
  },
  {
    employeeId: "1202",
    fullName: "Marta Klein",
    department: "Production",
    positionType: "direct",
    positionName: "Line Supervisor",
    managerEmployeeId: "1201",
    kat: "INDIR2",
  },
  {
    employeeId: "1401",
    fullName: "Roman Fabian",
    department: "Quality",
    positionType: "indirect",
    positionName: "Quality Manager",
    managerEmployeeId: "1001",
    kat: "INDIR3",
  },
  {
    employeeId: "1501",
    fullName: "Lucia Smidova",
    department: "HR",
    positionType: "salaried",
    positionName: "HR Manager",
    managerEmployeeId: "1001",
    kat: "SAL",
  },
];
