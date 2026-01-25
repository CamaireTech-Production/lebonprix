// Employee services
// Export employeeDisplayService first (more complete implementations)
export * from './employeeDisplayService';
// Export employeeRefService but exclude conflicting functions
export {
  searchUserByEmail,
  addEmployeeToCompany,
  removeEmployeeFromCompany,
  updateEmployeeRole,
  getCompanyEmployees,
  subscribeToEmployeeRefs
} from './employeeRefService';
export * from './invitationService';
export * from './permissionTemplateService';

