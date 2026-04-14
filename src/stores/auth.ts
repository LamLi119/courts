import { computed, reactive } from "vue";

export interface User {
	id: number;
	name: string;
	username: string;
	email: string;
	type: string;
	role?: "trainee" | "coach";
	phoneNo?: string;
	countryCode?: string;
	avatarSrc?: string;
}

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isInitialized: boolean;
	redirectPath: string;
	isClient: boolean;
}

const USER_PROFILE_STORAGE_KEY = "user";
const REDIRECT_PATH_STORAGE_KEY = "auth_redirect_path";

const state = reactive<AuthState>({
	user: null,
	isLoading: false,
	isInitialized: false,
	redirectPath: typeof window !== "undefined"
		? (sessionStorage.getItem(REDIRECT_PATH_STORAGE_KEY) || "/")
		: "/",
	isClient: typeof window !== "undefined",
});

function setUser(user: User | null) {
	state.user = user;

	if (state.isClient) {
		if (user) localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(user));
		else localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
	}
}

function setLoading(status: boolean) {
	state.isLoading = status;
}

function setInitialized(status: boolean) {
	state.isInitialized = status;
}

function setRedirectPath(path: string) {
	state.redirectPath = path;
	if (state.isClient) {
		if (path === "/") sessionStorage.removeItem(REDIRECT_PATH_STORAGE_KEY);
		else sessionStorage.setItem(REDIRECT_PATH_STORAGE_KEY, path);
	}
}

function setClientStatus(status: boolean) {
	state.isClient = status;
}

function loadUserFromStorage() {
	if (!state.isClient) return;
	const stored = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
	if (!stored) return;
	try {
		state.user = JSON.parse(stored);
	}
	catch (e) {
		console.error("Failed to parse stored user:", e);
		localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
	}
}

function clearUserFromStorage() {
	if (state.isClient) localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
	state.user = null;
}

function reset() {
	state.user = null;
	state.isInitialized = false;
	state.redirectPath = "/";
	if (state.isClient) sessionStorage.removeItem(REDIRECT_PATH_STORAGE_KEY);
	clearUserFromStorage();
}

export function useAuthStore() {
	return {
		// state
		get user() { return state.user; },
		get isLoading() { return state.isLoading; },
		get isInitialized() { return state.isInitialized; },
		get redirectPath() { return state.redirectPath; },
		get isClient() { return state.isClient; },

		// actions
		setUser,
		setLoading,
		setInitialized,
		setRedirectPath,
		setClientStatus,
		loadUserFromStorage,
		clearUserFromStorage,
		reset,

		// getters
		hasUser: computed(() => !!state.user),
		userFullName: computed(() => state.user?.name || ""),
		userEmail: computed(() => state.user?.email || ""),
		userUsername: computed(() => state.user?.username || ""),
		userProfileImage: computed(() => state.user?.avatarSrc || ""),
		isCoach: computed(() => state.user?.role === "coach"),
		isTrainee: computed(() => state.user?.role === "trainee"),
	};
}