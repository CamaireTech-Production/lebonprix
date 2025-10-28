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
import { addCompanyToUser } from './userService';
import { sendInvitationEmail, sendCompanyAccessNotification } from './emailService';
import { showSuccessToast, showErrorToast } from '../utils/toast';

/**
 * Check if a user exists in the system by email
 * @param email - Email to search for
 * @returns User data if found, null otherwise
 */
export const getUserByEmail = async (email: string) => {
  try {
    console.log('🔍 Searching for user with email:', email);
    
    // Query users collection by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ No user found with email:', email);
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() } as any;
    
    console.log('✅ User found:', userData.firstname, userData.lastname);
    return userData;
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
    role: 'staff' | 'manager' | 'admin';
  }
): Promise<Invitation> => {
  try {
    console.log('📝 Creating invitation for:', employeeData.email);
    
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
      email: employeeData.email.toLowerCase().trim(),
      firstname: employeeData.firstname,
      lastname: employeeData.lastname,
      phone: employeeData.phone,
      role: employeeData.role,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt)
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
 * Send invitation email
 * @param invitation - Invitation data
 * @returns Email result
 */
export const sendInvitationEmailToUser = async (invitation: Invitation) => {
  try {
    const inviteLink = `${window.location.origin}/invite/${invitation.id}`;
    
    const emailData = {
      to_email: invitation.email,
      to_name: `${invitation.firstname} ${invitation.lastname}`,
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
    const expiresAt = (invitation.expiresAt as any).toDate();
    if (now > expiresAt) {
      throw new Error('Invitation has expired');
    }
    
    // Add company to user's companies array
    const companyRef: UserCompanyRef = {
      companyId: invitation.companyId,
      name: invitation.companyName,
      role: invitation.role,
      joinedAt: Timestamp.now()
    };
    
    await addCompanyToUser(userId, companyRef);
    
    // Update invitation status
    const invitationRef = doc(db, 'invitations', inviteId);
    await updateDoc(invitationRef, {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });
    
    console.log('✅ Invitation accepted successfully');
    showSuccessToast('Welcome to the team! You now have access to the company.');
    
    return true;
  } catch (error: any) {
    console.error('❌ Error accepting invitation:', error);
    showErrorToast(error.message || 'Failed to accept invitation');
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
    role: 'staff' | 'manager' | 'admin';
  },
  existingUser: any
): Promise<boolean> => {
  try {
    console.log('👤 Handling invitation for existing user:', existingUser.email);
    
    // Check if user already has access to this company
    const hasAccess = existingUser.companies?.some((c: UserCompanyRef) => c.companyId === companyId);
    
    if (hasAccess) {
      showErrorToast('User already has access to this company');
      return false;
    }
    
    // Add company to user's companies array
    const companyRef: UserCompanyRef = {
      companyId,
      name: companyName,
      role: employeeData.role,
      joinedAt: Timestamp.now()
    };
    
    await addCompanyToUser(existingUser.id, companyRef);
    
    // Send notification email
    const emailData = {
      to_email: existingUser.email,
      to_name: `${existingUser.firstname} ${existingUser.lastname}`,
      company_name: companyName,
      inviter_name: inviterData.name,
      role: employeeData.role,
      invite_link: `${window.location.origin}/company/${companyId}/dashboard`,
      expires_in_days: 0
    };
    
    await sendCompanyAccessNotification(emailData);
    
    console.log('✅ Existing user added to company successfully');
    showSuccessToast('User has been added to the company and notified via email');
    
    return true;
  } catch (error: any) {
    console.error('❌ Error handling existing user invitation:', error);
    showErrorToast(error.message || 'Failed to add user to company');
    throw error;
  }
};
