import {
  CreateSharedItemResponseSchema,
  CreateUserResponseSchema,
  GetEventsResponseSchema,
  GetInboxMessagesResponseSchema,
  GetSharedItemResponseSchema,
  GetUserResponseSchema,
  GetUsersResponseSchema,
  type CreateSharedItemRequest,
  type CreateSharedItemResponse,
  type CreateUserResponse,
  type DeleteUserFollowSecretRequest,
  type DeleteUserRequest,
  type GetEventsRequest,
  type GetEventsResponse,
  type CreateSharedItemRequestWire,
  type GetInboxMessagesRequest,
  type GetInboxMessagesResponse,
  type GetSharedItemResponse,
  type GetUserResponse,
  type GetUsersRequest,
  type GetUsersResponse,
  type PutInboxMessageRequest,
  type PutInboxMessageRequestWire,
  type PutUserDataRequest,
  type PutUserDataRequestWire,
  type PutUserEventRequest,
  type PutUserEventRequestWire,
  type PutUserFollowSecretRequest,
} from '@liftlog/shared';
import { ApiErrorType, ApiResult, ResponseError } from '@/services/api-error';
import { parseWireResponse, rpcClient, toWireRequest } from '@/services/rpc-client';

export class FeedApiService {
  async getUserEventsAsync(request: GetEventsRequest): Promise<ApiResult<GetEventsResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.events.$post({ json: request });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, GetEventsResponseSchema);
    });
  }

  async createUserAsync(): Promise<ApiResult<CreateUserResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.user.create.$post({ json: {} });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, CreateUserResponseSchema);
    });
  }

  async getUserAsync(idOrLookup: string): Promise<ApiResult<GetUserResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.user[':idOrLookup'].$get({ param: { idOrLookup } });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, GetUserResponseSchema);
    });
  }

  async putUserDataAsync(request: PutUserDataRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.user.$put({ json: toWireRequest<PutUserDataRequestWire>(request) });
      this.ensureSuccessStatusCode(response);
    });
  }

  async putUserEventAsync(request: PutUserEventRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.event.$put({ json: toWireRequest<PutUserEventRequestWire>(request) });
      this.ensureSuccessStatusCode(response);
    });
  }

  async getUsersAsync(request: GetUsersRequest): Promise<ApiResult<GetUsersResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.users.$post({ json: request });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, GetUsersResponseSchema);
    });
  }

  async deleteUserAsync(request: DeleteUserRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.user.delete.$post({ json: request });
      this.ensureSuccessStatusCode(response);
    });
  }

  async putInboxMessageAsync(request: PutInboxMessageRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.inbox.$put({ json: toWireRequest<PutInboxMessageRequestWire>(request) });
      this.ensureSuccessStatusCode(response);
    });
  }

  async getInboxMessagesAsync(request: GetInboxMessagesRequest): Promise<ApiResult<GetInboxMessagesResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.inbox.$post({ json: request });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, GetInboxMessagesResponseSchema);
    });
  }

  async putUserFollowSecretAsync(request: PutUserFollowSecretRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient['follow-secret'].$put({ json: request });
      this.ensureSuccessStatusCode(response);
    });
  }

  async deleteUserFollowSecretAsync(request: DeleteUserFollowSecretRequest): Promise<ApiResult<void>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient['follow-secret'].delete.$post({ json: request });
      this.ensureSuccessStatusCode(response);
    });
  }

  async postSharedItemAsync(request: CreateSharedItemRequest): Promise<ApiResult<CreateSharedItemResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.shareditem.$post({ json: toWireRequest<CreateSharedItemRequestWire>(request) });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, CreateSharedItemResponseSchema);
    });
  }

  async getSharedItemAsync(sharedItemId: string): Promise<ApiResult<GetSharedItemResponse>> {
    return this.getApiResultAsync(async () => {
      const response = await rpcClient.shareditem[':id'].$get({ param: { id: sharedItemId } });
      this.ensureSuccessStatusCode(response);
      return parseWireResponse(response, GetSharedItemResponseSchema);
    });
  }

  private async getApiResultAsync<T>(action: () => Promise<T>): Promise<ApiResult<T>> {
    try {
      const data = await action();
      return new ApiResult<T>(data);
    } catch (error) {
      if (error instanceof ResponseError) {
        const response = error.response;
        console.debug('Error response', response, await response.text());
        const status = response.status;

        if (status === 404) {
          return ApiResult.fromError({
            type: ApiErrorType.NotFound,
            message: response.statusText,
            exception: error,
          });
        } else if (status === 401) {
          return ApiResult.fromError({
            type: ApiErrorType.Unauthorized,
            message: response.statusText,
            exception: error,
          });
        } else if (status === 429) {
          return ApiResult.fromError({
            type: ApiErrorType.RateLimited,
            message: response.statusText,
            exception: error,
          });
        }
      }

      return ApiResult.fromError({
        type: ApiErrorType.Unknown,
        message: (error as { message: string })?.message || 'An unknown error occurred',
        exception: error,
      });
    }
  }

  private ensureSuccessStatusCode(response: Response): void {
    if (!response.ok) {
      throw new ResponseError(response);
    }
  }
}
