import type { UserType } from "~/shared/types/users";

interface UserProfile {
	filePath: string;
}

export interface UserResponse {
	id: number;
	loginId: string;
	type: "coach" | "trainee"; // API only returns these two types
	name: string;
	profile?: UserProfile;
	description: string;
	age: number | string | null;
	height: number | string | null;
	weight: number | string | null;
	experience: string | string[] | null;
	awards: string | string[] | null;
}

export interface FileProfile {
	id: number;
	classId: number;
	companyId: string;
	lessonId: string;
	userId: number;
	type: number;
	name: string;
	url: string;
	filePath: string;
	date: string;
	noticeId: number;
	fileFormat: string;
	eventId: number;
	eventTimeSlotId: number;
}

export interface UserProfileResponse {
	name: string;
	email: string;
	description: string | null;
	phoneNo: string;
	countryCode: string;
	age: number | null;
	birth: string | null;
	height: number | null;
	weight: number | null;
	gender: string | null;
	personalAchievements: string | null;
	teamAchievements: string | null;
	experience: string | null;
	awards: string | null;
	profile: FileProfile;
	isMember: boolean;
	isCoach: boolean;
	joinedCourses: number;
	joinedEvents: number;
	hostedEvents: number;
	displayPhoneNo?: boolean;
	displayEmail?: boolean;
}

export interface ChangePasswordRequest {
	password: string;
	confirmPassword: string;
}