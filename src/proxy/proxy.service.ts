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

@Injectable()
export class ProxyService {
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
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }

      throw new HttpException(
        'BFF no disponible',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
