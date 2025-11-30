import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Invitation, UserCompanyRef } from '../types/models';
import { getUserById } from './userService';
import { addUserToCompany } from './userCompanySyncService';
import { sendInvitationEmail, sendCompanyAccessNotification } from './emailService';
import { getTemplateById } from './permissionTemplateService';
import { getEffectiveBaseRole } from '../utils/permissionUtils';
import { showSuccessToast, showErrorToast } from '../utils/toast';

/**
 * Normalize and validate email address
 * @param email - Email to normalize and validate
 * @returns Normalized email (lowercase, trimmed)
 * @throws Error if email is invalid
 */
const normalizeEmail = (email: string | undefined | null): string => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!trimmedEmail) {
    throw new Error('Email cannot be empty');
  }
  
  // Validation basique du format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Invalid email format');
  }
  
  return trimmedEmail;
};

/**
 * Format full name from firstname and lastname, handling undefined/null/empty values
 * @param firstname - First name (can be undefined, null, or empty)
 * @param lastname - Last name (can be undefined, null, or empty)
 * @returns Formatted full name, or "Utilisateur" if both are empty
 */
const formatFullName = (firstname?: string | null, lastname?: string | null): string => {
  const parts: string[] = [];
  
  // Add firstname if it's valid
  if (firstname && firstname.trim()) {
    parts.push(firstname.trim());
  }
  
  // Add lastname if it's valid
  if (lastname && lastname.trim()) {
    parts.push(lastname.trim());
  }
  
  // Join parts and normalize spaces
  const fullName = parts.join(' ').trim();
  
  // Return default if no valid name parts
  return fullName || 'Utilisateur';
};

/**
 * Result type for user email check
 * Discriminated union to handle all possible states
 */
export type UserCheckResult =
  | { type: 'not_found' }
  | { type: 'found'; user: import('../types/models').User }
  | { type: 'already_member'; user: import('../types/models').User }
  | { type: 'has_pending_invitation'; user: import('../types/models').User; invitation: Invitation };

/**
 * Check if a user exists in the system by email
 * Also checks if user is already a member or has pending invitation
 * @param email - Email to search for
 * @param companyId - Optional company ID to check membership and pending invitations
 * @returns UserCheckResult with discriminated union type
 */
export const getUserByEmail = async (email: string, companyId?: string): Promise<UserCheckResult> => {
  try {
    console.log('🔍 Searching for user with email:', email);
    
    // Query users collection by email
    const usersRef = collection(db, 'users');
    const normalizedEmail = email.toLowerCase().trim();
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ No user found with email:', email);
      return { type: 'not_found' };
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() } as import('../types/models').User;
    
    // If companyId not provided, just return found user
    if (!companyId) {
      console.log('✅ User found:', userData.firstname, userData.lastname);
      return { type: 'found', user: userData };
    }
    
    // Check if user is already a member of the company
    const isAlreadyMember = userData.companies?.some((c: UserCompanyRef) => c.companyId === companyId);
    
    if (isAlreadyMember) {
      console.log('⚠️ User already member of company:', companyId);
      return { type: 'already_member', user: userData };
    }
    
    // Check if user has a pending invitation for this company
    const invitationsRef = collection(db, 'invitations');
    const invitationQuery = query(
      invitationsRef,
      where('email', '==', normalizedEmail),
      where('companyId', '==', companyId),
      where('status', '==', 'pending')
    );
    const invitationSnapshot = await getDocs(invitationQuery);
    
    if (!invitationSnapshot.empty) {
      const invitationDoc = invitationSnapshot.docs[0];
      const invitationData = { id: invitationDoc.id, ...invitationDoc.data() } as Invitation;
      console.log('⚠️ User has pending invitation:', invitationData.id);
      return { type: 'has_pending_invitation', user: userData, invitation: invitationData };
    }
    
    console.log('✅ User found:', userData.firstname, userData.lastname);
    return { type: 'found', user: userData };
  } catch (error) {
    console.error('❌ Error searching for user by email:', error);
    throw error;
  }
};

/**
 * Create a new invitation
 * @param companyId - ID of the company
 * @param inviterData - Data of the person creating the invitation
 * @param employeeData - Data of the employee being invited
 * @returns Created invitation
 */
export const createInvitation = async (
  companyId: string,
  companyName: string,
  inviterData: { id: string; name: string },
  employeeData: {
    email: string;
    firstname: string;
    lastname: string;
    phone?: string;
    permissionTemplateId: string;
  }
): Promise<Invitation> => {
  try {
    // Normalize and validate email
    const normalizedEmail = normalizeEmail(employeeData.email);
    
    console.log('📝 Creating invitation for:', normalizedEmail);
    
    // Generate unique invitation ID
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const invitation: Invitation = {
      id: invitationId,
      companyId,
      companyName,
      invitedBy: inviterData.id,
      invitedByName: inviterData.name,
      email: normalizedEmail,
      firstname: employeeData.firstname,
      lastname: employeeData.lastname,
      phone: employeeData.phone,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      permissionTemplateId: employeeData.permissionTemplateId
    };
    
    // Save invitation to Firestore
    const invitationRef = doc(db, 'invitations', invitationId);
    await setDoc(invitationRef, invitation);
    
    console.log('✅ Invitation created:', invitationId);
    return invitation;
  } catch (error) {
    console.error('❌ Error creating invitation:', error);
    throw error;
  }
};

/**
 * Generate invitation link URL
 * @param invitationId - Invitation ID
 * @returns Full invitation link URL
 */
export const getInvitationLink = (invitationId: string): string => {
  return `${window.location.origin}/invite/${invitationId}`;
};

/**
 * Send invitation email
 * @param invitation - Invitation data
 * @returns Email result
 */
export const sendInvitationEmailToUser = async (invitation: Invitation) => {
  try {
    // Validate invitation email before constructing email data
    if (!invitation.email || !invitation.email.trim()) {
      throw new Error('Invitation email is empty or invalid');
    }
    
    const inviteLink = getInvitationLink(invitation.id);
    
    const emailData = {
      to_email: invitation.email,
      to_name: formatFullName(invitation.firstname, invitation.lastname),
      company_name: invitation.companyName,
      inviter_name: invitation.invitedByName,
      role: invitation.role,
      invite_link: inviteLink,
      expires_in_days: 7
    };
    
    const result = await sendInvitationEmail(emailData);
    
    if (result.success) {
      console.log('✅ Invitation email sent successfully');
      showSuccessToast('Invitation email sent successfully');
    } else {
      console.error('❌ Failed to send invitation email:', result.error);
      showErrorToast(`Failed to send email: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    showErrorToast('Failed to send invitation email');
    throw error;
  }
};

/**
 * Get invitation by ID
 * @param inviteId - Invitation ID
 * @returns Invitation data or null
 */
export const getInvitation = async (inviteId: string): Promise<Invitation | null> => {
  try {
    const invitationRef = doc(db, 'invitations', inviteId);
    const invitationDoc = await getDoc(invitationRef);
    
    if (!invitationDoc.exists()) {
      return null;
    }
    
    return { id: invitationDoc.id, ...invitationDoc.data() } as Invitation;
  } catch (error) {
    console.error('❌ Error getting invitation:', error);
    throw error;
  }
};

/**
 * Accept invitation and link user to company
 * @param inviteId - Invitation ID
 * @param userId - User ID accepting the invitation
 * @returns Success result
 */
export const acceptInvitation = async (inviteId: string, userId: string): Promise<boolean> => {
  try {
    console.log('✅ Accepting invitation:', inviteId, 'for user:', userId);
    
    // Get invitation
    const invitation = await getInvitation(inviteId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }
    
    // Check if invitation is expired
    const now = new Date();
    const expiresAt = (invitation.expiresAt as import('../types/models').Timestamp).seconds * 1000;
    if (now.getTime() > expiresAt) {
      throw new Error('Invitation has expired');
    }
    
    // Get user data
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get company data
    const companyDoc = await getDoc(doc(db, 'companies', invitation.companyId));
    if (!companyDoc.exists()) {
      throw new Error('Company not found');
    }
    const companyData = companyDoc.data();
    
    // Get permission template to extract baseRole
    console.log('📋 [acceptInvitation] Loading template:', invitation.permissionTemplateId);
    const template = await getTemplateById(invitation.companyId, invitation.permissionTemplateId);
    if (!template) {
      console.error('❌ [acceptInvitation] Template not found:', invitation.permissionTemplateId);
      throw new Error('Permission template not found');
    }
    
    console.log('✅ [acceptInvitation] Template loaded:', template);
    
    // Use baseRole from template, or detect it automatically from permissions
    const baseRole = getEffectiveBaseRole(template);
    console.log('🎯 [acceptInvitation] Using baseRole:', baseRole);
    
    // Add user to company using addUserToCompany (creates employeeRef, updates company.employees{}, employeeCount, and users.companies[])
    await addUserToCompany(
      userId,
      invitation.companyId,
      {
        name: companyData.name,
        description: companyData.description,
        logo: companyData.logo
      },
      {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email
      },
      baseRole,
      invitation.permissionTemplateId
    );
    
    // Update invitation status
    const invitationRef = doc(db, 'invitations', inviteId);
    await updateDoc(invitationRef, {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });
    
    console.log('✅ Invitation accepted successfully');
    showSuccessToast('Welcome to the team! You now have access to the company.');
    
    return true;
  } catch (error: unknown) {
    console.error('❌ Error accepting invitation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept invitation';
    showErrorToast(errorMessage);
    throw error;
  }
};

/**
 * Reject invitation
 * @param inviteId - Invitation ID
 * @returns Success result
 */
export const rejectInvitation = async (inviteId: string): Promise<boolean> => {
  try {
    console.log('❌ Rejecting invitation:', inviteId);
    
    const invitationRef = doc(db, 'invitations', inviteId);
    await updateDoc(invitationRef, {
      status: 'rejected'
    });
    
    console.log('✅ Invitation rejected successfully');
    showSuccessToast('Invitation rejected');
    
    return true;
  } catch (error) {
    console.error('❌ Error rejecting invitation:', error);
    showErrorToast('Failed to reject invitation');
    throw error;
  }
};

/**
 * Get all pending invitations for a company
 * @param companyId - Company ID
 * @returns Array of pending invitations
 */
export const getPendingInvitations = async (companyId: string): Promise<Invitation[]> => {
  try {
    const invitationsRef = collection(db, 'invitations');
    const q = query(
      invitationsRef,
      where('companyId', '==', companyId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const invitations: Invitation[] = [];
    
    querySnapshot.forEach((doc) => {
      invitations.push({ id: doc.id, ...doc.data() } as Invitation);
    });
    
    return invitations;
  } catch (error) {
    console.error('❌ Error getting pending invitations:', error);
    throw error;
  }
};

/**
 * Cancel/revoke invitation
 * @param inviteId - Invitation ID
 * @returns Success result
 */
export const cancelInvitation = async (inviteId: string): Promise<boolean> => {
  try {
    console.log('🗑️ Cancelling invitation:', inviteId);
    
    const invitationRef = doc(db, 'invitations', inviteId);
    await deleteDoc(invitationRef);
    
    console.log('✅ Invitation cancelled successfully');
    showSuccessToast('Invitation cancelled');
    
    return true;
  } catch (error) {
    console.error('❌ Error cancelling invitation:', error);
    showErrorToast('Failed to cancel invitation');
    throw error;
  }
};

/**
 * Handle invitation for existing user (immediate company access)
 * @param companyId - Company ID
 * @param companyName - Company name
 * @param inviterData - Inviter data
 * @param employeeData - Employee data
 * @param existingUser - Existing user data
 * @returns Success result
 */
export const handleExistingUserInvitation = async (
  companyId: string,
  companyName: string,
  inviterData: { id: string; name: string },
  employeeData: {
    email: string;
    firstname: string;
    lastname: string;
    phone?: string;
    permissionTemplateId: string;
  },
  existingUser: import('../types/models').User
): Promise<boolean> => {
  try {
    // Validate existing user email before proceeding
    if (!existingUser.email || !existingUser.email.trim()) {
      throw new Error('User email is empty or invalid');
    }
    
    console.log('👤 Handling invitation for existing user:', existingUser.email);
    
    // Check if user already has access to this company
    const hasAccess = existingUser.companies?.some((c: UserCompanyRef) => c.companyId === companyId);
    
    if (hasAccess) {
      showErrorToast('User already has access to this company');
      return false;
    }
    
    // Get company data
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (!companyDoc.exists()) {
      throw new Error('Company not found');
    }
    const companyData = companyDoc.data();
    
    // Get permission template to extract baseRole
    console.log('📋 [handleExistingUserInvitation] Loading template:', employeeData.permissionTemplateId);
    const template = await getTemplateById(companyId, employeeData.permissionTemplateId);
    if (!template) {
      console.error('❌ [handleExistingUserInvitation] Template not found:', employeeData.permissionTemplateId);
      throw new Error('Permission template not found');
    }
    
    console.log('✅ [handleExistingUserInvitation] Template loaded:', template);
    
    // Use baseRole from template, or detect it automatically from permissions
    const baseRole = getEffectiveBaseRole(template);
    console.log('🎯 [handleExistingUserInvitation] Using baseRole:', baseRole);
    
    // Add user to company using addUserToCompany (creates employeeRef, updates company.employees{}, employeeCount, and users.companies[])
    await addUserToCompany(
      existingUser.id,
      companyId,
      {
        name: companyName,
        description: companyData.description,
        logo: companyData.logo
      },
      {
        firstname: existingUser.firstname,
        lastname: existingUser.lastname,
        email: existingUser.email
      },
      baseRole,
      employeeData.permissionTemplateId
    );
    
    // Send notification email
    const emailData = {
      to_email: existingUser.email,
      to_name: formatFullName(existingUser.firstname, existingUser.lastname),
      company_name: companyName,
      inviter_name: inviterData.name,
      role: baseRole,
      invite_link: `${window.location.origin}/company/${companyId}/dashboard`,
      expires_in_days: 0
    };
    
    await sendCompanyAccessNotification(emailData);
    
    console.log('✅ Existing user added to company successfully');
    showSuccessToast('User has been added to the company and notified via email');
    
    return true;
  } catch (error: unknown) {
    console.error('❌ Error handling existing user invitation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add user to company';
    showErrorToast(errorMessage);
    throw error;
  }
};
