import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  listRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  runProduction,
  listProductionRuns,
} from '../controllers/recipeController.js';

const router = Router();

router.get('/',            authenticate, listRecipes);
router.post('/',           authenticate, authorize(['ADMIN', 'MANAGER']), createRecipe);
router.put('/:id',         authenticate, authorize(['ADMIN', 'MANAGER']), updateRecipe);
router.delete('/:id',      authenticate, authorize(['ADMIN', 'MANAGER']), deleteRecipe);
router.post('/production', authenticate, authorize(['ADMIN', 'MANAGER']), runProduction);
router.get('/production',  authenticate, listProductionRuns);

export default router;
