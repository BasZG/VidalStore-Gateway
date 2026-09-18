import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type {
  AxiosRequestConfig,
  Method,
} from 'axios';
import { firstValueFrom } from 'rxjs';

type UpstreamError = {
  code?: string;
  response?: {
    status: number;
    data: unknown;
  };
};

@Injectable()
export class ProxyService {
  private static readonly TIMEOUT_MS = 3000;

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async forward(
    targetBaseUrl: string,
    path: string,
    method: Method,
    data?: unknown,
    authorization?: string,
  ) {
    const url = `${targetBaseUrl}${path}`;

    const config: AxiosRequestConfig = {
      method,
      url,
      data,
      timeout: ProxyService.TIMEOUT_MS,
      validateStatus: () => true,
      headers: {
        ...(authorization
          ? { Authorization: authorization }
          : {}),
        ...(data !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request(config),
      );

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error: unknown) {
      const axiosError = error as UpstreamError;

      if (axiosError.response) {
        return {
          status: axiosError.response.status,
          data: axiosError.response.data,
        };
      }

      if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ETIMEDOUT'
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.GATEWAY_TIMEOUT,
            message: 'Gateway Timeout',
          },
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'Bad Gateway',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
