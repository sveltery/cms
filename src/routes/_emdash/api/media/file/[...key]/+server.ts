import type {RequestHandler} from './$types';
import {GET as pinnedFile} from '$lib/server/media/source/routes/media/file';
import {requestMediaStorage} from '$lib/server/media/storage';
export const GET:RequestHandler=async event=>pinnedFile({params:{key:event.params.key},locals:{emdash:{storage:await requestMediaStorage(event)}}});
