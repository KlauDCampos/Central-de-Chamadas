import { Papel } from '../../enums/Papel';
import { userRepository } from '../users/user.repository';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../utils/AppError';

export const authService = {
  async register(input: { nome: string; email: string; senha: string }) {
    const existente = await userRepository.findByEmail(input.email);
    if (existente) {
      throw AppError.conflict('Já existe um usuário cadastrado com este e-mail');
    }

    const senhaHash = await hashPassword(input.senha);
    // Cadastro público sempre cria SOLICITANTE (ver auth.schemas.ts para o porquê).
    const usuario = await userRepository.create({
      nome: input.nome,
      email: input.email,
      senhaHash,
      papel: Papel.SOLICITANTE,
    });

    const token = signToken({ sub: usuario.id, email: usuario.email, papel: usuario.papel });

    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      token,
    };
  },

  async login(input: { email: string; senha: string }) {
    const usuario = await userRepository.findByEmail(input.email);
    if (!usuario) {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    const senhaValida = await comparePassword(input.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    const token = signToken({ sub: usuario.id, email: usuario.email, papel: usuario.papel });

    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      token,
    };
  },
};
